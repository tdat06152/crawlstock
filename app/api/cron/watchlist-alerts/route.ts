
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getScanSnapshot } from '@/lib/sheets-client';
import { getSymbolNews, getMarketNews } from '@/lib/market-data';
import { analyzeStockStrategyConcise } from '@/lib/gemini';
import { sendTelegramMessage } from '@/lib/telegram';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
    // Auth Check
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // return new NextResponse('Unauthorized', { status: 401 });
    }

    const supabase = createServiceClient();
    const startTime = Date.now();
    const logId = crypto.randomUUID();

    await supabase.from('jobs_log').insert({
        id: logId,
        job_name: 'Watchlist Alerts',
        status: 'RUNNING',
        meta: { start_time: new Date().toISOString() }
    });

    try {
        const marketContext = await getMarketNews();

        // 1. Get Latest Scan Snapshot
        const today = new Date().toISOString().split('T')[0];
        let scanResults = await getScanSnapshot(today);
        if (!scanResults || scanResults.length === 0) {
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            scanResults = await getScanSnapshot(yesterday);
        }

        if (!scanResults || scanResults.length === 0) {
            throw new Error('No scan results found');
        }

        const marketMap = new Map();
        scanResults.forEach((item: any) => {
            marketMap.set(item.symbol, item);
        });

        // 2. Get Users and Watchlists
        const { data: settings } = await supabase
            .from('user_scan_settings')
            .select('*');

        const { data: items } = await supabase
            .from('watchlist_items')
            .select('symbol, watchlist_id, watchlists!inner(user_id)');

        if (!items) return NextResponse.json({ processed: 0 });

        const alertsToInsert: any[] = [];
        const seenAlerts = new Set();

        for (const item of items) {
            const symbol = item.symbol;
            const watchlistData: any = item.watchlists;
            const userId = Array.isArray(watchlistData) ? watchlistData[0]?.user_id : watchlistData?.user_id;

            if (!userId) continue;

            const userSetting = settings?.find((s: any) => s.user_id === userId) || {
                overbought: 70,
                oversold: 30,
                near_overbought_from: 65,
                near_oversold_to: 35,
                enable_ema200_macd: true
            };

            const marketData = marketMap.get(symbol);
            if (!marketData) continue;

            // --- STRATEGY 1: RSI ---
            let rsiState = null;
            let rsiMessage = '';
            const rsi = marketData.rsi;
            const slope = marketData.slope_5;

            if (rsi < (userSetting.oversold || 30)) {
                rsiState = 'OVERSOLD';
                rsiMessage = `RSI ${rsi} (Quá bán). Momentum: ${slope}`;
            } else if (rsi > (userSetting.overbought || 70)) {
                rsiState = 'OVERBOUGHT';
                rsiMessage = `RSI ${rsi} (Quá mua). Momentum: ${slope}`;
            }

            if (rsiState) {
                if (slope > 0 && rsiState === 'OVERSOLD') {
                    rsiMessage += " [TÍN HIỆU HỒI PHỤC]";
                }

                const key = `${userId}-${symbol}-${marketData.scan_date}-RSI-${rsiState}`;
                if (!seenAlerts.has(key)) {
                    alertsToInsert.push({
                        user_id: userId,
                        symbol: symbol,
                        scan_date: marketData.scan_date || today,
                        strategy: 'RSI',
                        signal_type: 'INFO',
                        rsi: rsi,
                        state: rsiState,
                        slope_5: slope,
                        message: rsiMessage,
                        is_sent: false
                    });
                    seenAlerts.add(key);
                }
            }

            // --- STRATEGY 2: EMA200 + MACD ---
            let emaState = null;
            if (userSetting.enable_ema200_macd !== false) {
                emaState = marketData.ema200_macd_state;
                if (emaState === 'EMA200_MACD_BUY' || emaState === 'EMA200_MACD_SELL') {
                    const signalType = emaState === 'EMA200_MACD_BUY' ? 'BUY' : 'SELL';
                    const key = `${userId}-${symbol}-${marketData.scan_date}-EMA200_MACD-${signalType}`;

                    if (!seenAlerts.has(key)) {
                        let msg = '';
                        if (signalType === 'BUY') {
                            msg = `Tín hiệu MUA: MACD cắt lên Signal trong xu hướng EMA200.`;
                        } else {
                            msg = marketData.macd_cross === 'cross_down'
                                ? `Tín hiệu BÁN: MACD cắt xuống Signal.`
                                : `Tín hiệu BÁN: Giá gãy EMA200.`;
                        }

                        alertsToInsert.push({
                            user_id: userId,
                            symbol: symbol,
                            scan_date: marketData.scan_date || today,
                            strategy: 'EMA200_MACD',
                            signal_type: signalType,
                            ema200: marketData.ema200,
                            macd: marketData.macd,
                            macd_signal: marketData.macd_signal,
                            macd_hist: marketData.macd_hist,
                            state: emaState,
                            message: msg,
                            is_sent: false
                        });
                        seenAlerts.add(key);
                    }
                }
            }

            // --- STRATEGY 3: BOLLINGER BREAKOUT ---
            let bb_state = null;
            if (userSetting.enable_bb_breakout !== false) {
                bb_state = marketData.bb_state;
                if (bb_state && bb_state !== 'BB_NEUTRAL') {
                    let signalType: 'BUY' | 'EXIT' | 'INFO' = 'INFO';
                    let signalTypeLabel = 'INFO'; // used for key

                    if (bb_state === 'BB_BREAKOUT_BUY') {
                        signalType = 'BUY';
                        signalTypeLabel = 'BUY';
                    } else if (bb_state === 'BB_BREAKOUT_EXIT') {
                        signalType = 'EXIT'; // mapped to 'EXIT' in DB or just use state
                        signalTypeLabel = 'EXIT';
                    } else if (bb_state === 'BB_BREAKOUT_WEAK') {
                        signalType = 'INFO';
                        signalTypeLabel = 'WEAK';
                    }

                    const key = `${userId}-${symbol}-${marketData.scan_date}-BB_BREAKOUT-${signalTypeLabel}`;

                    if (!seenAlerts.has(key)) {
                        let msg = '';
                        if (bb_state === 'BB_BREAKOUT_BUY') {
                            msg = `Bùng nổ BB: Close > Upper Band. VolRatio: ${marketData.vol_ratio}x, ADX: ${marketData.adx14}.`;
                        } else if (bb_state === 'BB_BREAKOUT_EXIT') {
                            msg = `Cảnh báo thoát: Giá đóng cửa dưới đường Middle BB (SMA20).`;
                        } else if (bb_state === 'BB_BREAKOUT_WEAK') {
                            msg = `Breakout yếu: Giá vượt biên trên nhưng thiếu Volume (${marketData.vol_ratio}x) hoặc lực Trend (ADX: ${marketData.adx14}).`;
                        }

                        alertsToInsert.push({
                            user_id: userId,
                            symbol: symbol,
                            scan_date: marketData.scan_date || today,
                            strategy: 'BB_BREAKOUT',
                            signal_type: signalType,
                            bb_mid: marketData.bb_mid,
                            bb_upper: marketData.bb_upper,
                            bb_lower: marketData.bb_lower,
                            adx14: marketData.adx14,
                            vol_ratio: marketData.vol_ratio,
                            state: bb_state,
                            message: msg,
                            is_sent: false
                        });
                        seenAlerts.add(key);
                    }
                }
            }

            // --- CONFLUENCE CHECK & TELEGRAM ---
            // Only send recommendation if all 3 indicators align
            const isPotentialBuy =
                emaState === 'EMA200_MACD_BUY' &&
                bb_state === 'BB_BREAKOUT_BUY' &&
                (marketData.rsi > 60 || marketData.rsi < 35); // RSI strong momentum or reversal

            const isPotentialSell =
                emaState === 'EMA200_MACD_SELL' &&
                bb_state === 'BB_BREAKOUT_EXIT' &&
                (marketData.rsi < 40 || marketData.rsi > 65);

            if (isPotentialBuy || isPotentialSell) {
                const signalType = isPotentialBuy ? 'BUY' : 'SELL';
                const key = `${userId}-${symbol}-${marketData.scan_date}-CONFLUENCE-${signalType}`;

                if (!seenAlerts.has(key)) {
                    try {
                        const news = await getSymbolNews(symbol);
                        const aiAnalysis = await analyzeStockStrategyConcise({
                            symbol,
                            close: marketData.close,
                            indicators: {
                                rsi: { value: marketData.rsi, state: marketData.state },
                                ema_macd: { state: emaState, macd_hist: marketData.macd_hist },
                                bb: { state: bb_state, vol_ratio: marketData.vol_ratio }
                            },
                            news,
                            marketContext
                        });

                        const typeEmoji = isPotentialBuy ? '🟢 KHUYẾN NGHỊ MUA MẠNH' : '🔴 KHUYẾN NGHỊ BÁN MẠNH';
                        const telegramMsg = `
<b>[KHUYẾN NGHỊ] ${symbol}</b> - ${typeEmoji}
<i>Tín hiệu xác nhận đồng nhất từ 3 mẫu hình kỹ thuật</i>

Giá hiện tại: ${marketData.close.toLocaleString('vi-VN')}
- RSI: ${marketData.rsi} (${marketData.state})
- EMA/MACD: ${emaState}
- BB: ${bb_state} (Vol: ${marketData.vol_ratio}x)

<b>🤖 Phân tích AI:</b>
<i>${aiAnalysis}</i>
`.trim();
                        await sendTelegramMessage(telegramMsg);
                        seenAlerts.add(key); // Mark as sent to avoid double messages in one run
                    } catch (aiErr) {
                        console.error(`AI Analysis failed for confluence ${symbol}:`, aiErr);
                    }
                }
            }

        }

        if (alertsToInsert.length > 0) {
            const { error } = await supabase.from('alerts').upsert(alertsToInsert, {
                onConflict: 'user_id, symbol, scan_date, strategy, signal_type'
            });
            if (error) throw error;
        }

        await supabase.from('jobs_log').update({
            status: 'OK',
            meta: { generated_alerts: alertsToInsert.length }
        }).eq('id', logId);

        return NextResponse.json({ success: true, alerts: alertsToInsert.length });

    } catch (error: any) {
        console.error('Alerts Job failed:', error);
        await supabase.from('jobs_log').update({
            status: 'FAILED',
            meta: { error: error.message }
        }).eq('id', logId);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
