import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { VNMarketClient } from '@/lib/vn-market';
import {
    shouldTriggerAlert,
    isCooldownExpired,
    generateAlertReason,
    isInZone
} from '@/lib/alert-logic';
import { Watchlist, WatchlistState } from '@/lib/types';
import { sendTelegramMessage } from '@/lib/telegram';
import { getSymbolNews } from '@/lib/market-data';
import { analyzeStockStrategyConcise } from '@/lib/gemini';
import { calculateRSIArray, analyzeRSI } from '@/lib/rsi';
import { analyzeEMAMACD, analyzeBBBreakout } from '@/lib/indicators';

export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('Authorization');
    const xCronSecret = request.headers.get('x-cron-secret');
    const secret = process.env.CRON_SECRET;

    console.log('[Cron] Polling prices triggered at:', new Date().toISOString());

    if (
        (authHeader !== `Bearer ${secret}`) &&
        (xCronSecret !== secret)
    ) {
        console.error('[Cron] Unauthorized access attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const vnMarket = new VNMarketClient(); // No API Key needed

    try {
        // 1. Load all enabled watchlists
        const { data: watchlists, error: watchlistError } = await supabase
            .from('watchlists')
            .select('*')
            .eq('enabled', true);

        if (watchlistError) {
            console.error('Error loading watchlists:', watchlistError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        if (!watchlists || watchlists.length === 0) {
            return NextResponse.json({
                message: 'No enabled watchlists found',
                processed: 0
            });
        }

        // 2. De-duplicate symbols
        const uniqueSymbols = Array.from(new Set(watchlists.map(w => w.symbol)));
        console.log(`Processing ${uniqueSymbols.length} unique symbols from ${watchlists.length} watchlists`);

        // 3. Fetch prices from VN Market
        const prices = await vnMarket.getLatestPrices(uniqueSymbols);
        console.log(`Fetched ${prices.length} prices`);

        // 4. Upsert prices into latest_prices table
        const updateResults = [];
        for (const priceData of prices) {
            const { error: upsertError } = await supabase
                .from('latest_prices')
                .upsert({
                    symbol: priceData.symbol,
                    price: priceData.price,
                    ts: priceData.timestamp,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'symbol'
                });

            if (upsertError) {
                console.error(`Error upserting price for ${priceData.symbol}:`, upsertError);
                updateResults.push({ symbol: priceData.symbol, status: 'error', error: upsertError });
            } else {
                updateResults.push({ symbol: priceData.symbol, status: 'success', price: priceData.price });
            }
        }

        // 5. Process alerts for each watchlist
        let alertsCreated = 0;
        const priceMap = new Map(prices.map(p => [p.symbol, p]));

        for (const watchlist of (watchlists || []) as Watchlist[]) {
            const priceData = priceMap.get(watchlist.symbol);
            if (!priceData) continue;

            // Get current state
            const { data: stateData } = await supabase
                .from('watchlist_state')
                .select('*')
                .eq('watchlist_id', watchlist.id)
                .single();

            const state = stateData as WatchlistState | null;

            // Check if alert should be triggered
            const triggerThisTime = shouldTriggerAlert(priceData.price, watchlist, state);
            if (triggerThisTime) {
                // Check cooldown
                if (!isCooldownExpired(state?.last_alert_at || null, watchlist.cooldown_minutes)) {
                    console.log(`Cooldown active for ${watchlist.symbol}, skipping alert`);
                } else {
                    // Create alert
                    const reason = generateAlertReason(
                        watchlist.symbol,
                        priceData.price,
                        watchlist.buy_min,
                        watchlist.buy_max
                    );

                    const { error: alertError } = await supabase
                        .from('alerts')
                        .insert({
                            user_id: watchlist.user_id,
                            watchlist_id: watchlist.id,
                            symbol: watchlist.symbol,
                            price: priceData.price,
                            reason
                        });

                    if (alertError) {
                        console.error(`Error creating alert for ${watchlist.symbol}:`, alertError);
                    } else {
                        alertsCreated++;
                        console.log(`Alert created for ${watchlist.symbol} at ${priceData.price}`);

                        // Gửi tin nhắn Telegram
                        let aiAnalysis = '';
                        try {
                            const news = await getSymbolNews(watchlist.symbol);
                            // Fetch some history for indicators
                            const { getSymbolHistory } = await import('@/lib/market-data');
                            const history = await getSymbolHistory(watchlist.symbol, 100);
                            const closes = history.map(h => h.c);
                            const highs = history.map(h => h.h);
                            const lows = history.map(h => h.l);
                            const volumes = history.map(h => h.v);

                            const rsi = analyzeRSI(calculateRSIArray(closes));
                            const emaMacd = analyzeEMAMACD(closes);
                            const bb = analyzeBBBreakout(highs, lows, closes, volumes);

                            aiAnalysis = await analyzeStockStrategyConcise({
                                symbol: watchlist.symbol,
                                close: priceData.price,
                                indicators: {
                                    rsi: { value: rsi.value, state: rsi.state },
                                    ema_macd: { state: emaMacd.state },
                                    bb: { state: bb.state }
                                },
                                news
                            });
                        } catch (aiErr) {
                            console.warn('AI Analysis failed for price alert:', aiErr);
                        }

                        const telegramMsg = `
<b>🔔 ALERT: ${watchlist.symbol}</b>
Giá: <b>${priceData.price}</b> (Vào vùng: ${watchlist.buy_min} - ${watchlist.buy_max})
Hành động: <b>${reason}</b>

<b>AI Nhận định:</b>
<i>${aiAnalysis || 'Đang cập nhật...'}</i>

🕒 ${new Date().toLocaleString('vi-VN')}
                        `.trim();

                        await sendTelegramMessage(telegramMsg);
                    }
                }
            }

            // Update state
            const currentlyInZone = isInZone(priceData.price, watchlist.buy_min, watchlist.buy_max);
            const { error: stateError } = await supabase
                .from('watchlist_state')
                .upsert({
                    watchlist_id: watchlist.id,
                    last_in_zone: currentlyInZone,
                    last_price: priceData.price,
                    last_ts: priceData.timestamp,
                    last_alert_at: triggerThisTime
                        ? new Date().toISOString()
                        : state?.last_alert_at || null
                }, {
                    onConflict: 'watchlist_id'
                });

            if (stateError) {
                console.error(`Error updating state for ${watchlist.symbol}:`, stateError);
            }
        }

        return NextResponse.json({
            success: true,
            source: 'DNSE/Entrade Real-time',
            symbols_processed: prices.length,
            watchlists_checked: watchlists?.length || 0,
            updates: updateResults,
            alerts_created: alertsCreated
        });

    } catch (error) {
        console.error('Cron job error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
