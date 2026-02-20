
import { createServiceClient } from '@/lib/supabase-server';
import crypto from 'crypto';
import { getAllSymbols, getSymbolHistory, getSymbolNews, getMarketNews } from '@/lib/market-data';
import { calculateRSIArray, analyzeRSI } from '@/lib/rsi';
import { analyzeEMAMACD, analyzeBBBreakout } from '@/lib/indicators';
import { writeScanSnapshot, cleanupOldSnapshots } from '@/lib/sheets-client';
import { analyzeStockStrategyConcise } from '@/lib/gemini';
import { sendTelegramMessage } from '@/lib/telegram';

export async function runMarketScan() {
    const startTime = Date.now();
    const supabase = createServiceClient();

    // Log Start
    const logId = crypto.randomUUID();
    console.log(`[Market Scan] Starting job with ID: ${logId}`);

    const { error: logError } = await supabase.from('jobs_log').insert({
        id: logId,
        job_name: 'Market Scan',
        status: 'RUNNING',
        meta: { start_time: new Date().toISOString(), phase: 'STARTED' }
    });

    if (logError) {
        console.error('[Market Scan] Failed to create initial log:', logError);
    }

    try {
        // 2. Scan
        console.log('[Market Scan] Fetching symbols...');
        let symbols = await getAllSymbols();

        // Plus: Get symbols from user watchlists to ensure they are scanned FIRST
        const { data: watchlistData } = await supabase.from('watchlists').select('symbol');
        const watchlistSymbols = watchlistData ? watchlistData.map(w => w.symbol) : [];

        if (watchlistSymbols.length > 0) {
            // Put watchlist symbols at the beginning, then the rest
            const others = symbols.filter(s => !watchlistSymbols.includes(s));
            symbols = [...new Set([...watchlistSymbols, ...others])];
        }

        console.log(`[Market Scan] Found ${symbols.length} symbols to process (including watchlists)`);

        const results = [];
        // Concurrency limit - Increase to 50 for faster processing
        const CONCURRENCY = 50;
        const items = symbols;

        // Process in chunks
        for (let i = 0; i < items.length; i += CONCURRENCY) {
            // Check time left - 300s limit is less relevant for manual runs but good practice
            if (Date.now() - startTime > 280000) {
                console.log('Time limit reached, stopping scan');
                break;
            }

            const chunk = items.slice(i, i + CONCURRENCY);
            const promises = chunk.map(async (symbol) => {
                try {
                    // Fetch 250 candles - sufficient for EMA200 stability and faster
                    const history = await getSymbolHistory(symbol, 250);
                    if (history.length < 20) return null;

                    const closes = history.map(h => h.c);
                    const highs = history.map(h => h.h);
                    const lows = history.map(h => h.l);
                    const volumes = history.map(h => h.v);

                    // Skip illiquid stocks (zero volume in last 5 days) to save processing time
                    const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0);
                    if (recentVol === 0 && !watchlistSymbols.includes(symbol)) return null;

                    // 1. RSI Logic
                    const rsiSeries = calculateRSIArray(closes, 14);
                    const rsiAnalysis = analyzeRSI(rsiSeries);

                    // 2. EMA200 + MACD Logic
                    const emaMacdAnalysis = analyzeEMAMACD(closes);

                    // 3. Bollinger Breakout Logic (Default params for scan)
                    const bbAnalysis = analyzeBBBreakout(highs, lows, closes, volumes, {
                        bbPeriod: 20,
                        bbStdMult: 2.0,
                        volRatioMin: 1.3,
                        adxMin: 20,
                        requireAdxRising: true
                    });

                    if (rsiAnalysis.value === null && emaMacdAnalysis.ema200 === null && bbAnalysis.mid === null) return null;

                    return {
                        symbol,
                        close: closes[closes.length - 1],
                        // RSI fields
                        rsi: rsiAnalysis.value,
                        state: rsiAnalysis.state,
                        near_flag: rsiAnalysis.near_flag,
                        slope_5: rsiAnalysis.slope_5,
                        distance_to_30: rsiAnalysis.distance_to_30,
                        distance_to_70: rsiAnalysis.distance_to_70,
                        // EMA+MACD fields
                        ema200: emaMacdAnalysis.ema200,
                        distance_to_ema200_pct: emaMacdAnalysis.distance_to_ema200_pct,
                        macd: emaMacdAnalysis.macd,
                        macd_signal: emaMacdAnalysis.macd_signal,
                        macd_hist: emaMacdAnalysis.macd_hist,
                        macd_cross: emaMacdAnalysis.macd_cross,
                        ema200_macd_state: emaMacdAnalysis.state,
                        // BB fields
                        bb_mid: bbAnalysis.mid,
                        bb_upper: bbAnalysis.upper,
                        bb_lower: bbAnalysis.lower,
                        bb_bandwidth_pct: bbAnalysis.bandwidth_pct,
                        vol: volumes[volumes.length - 1],
                        vol_ma20: bbAnalysis.vol_ma20,
                        vol_ratio: bbAnalysis.vol_ratio,
                        adx14: bbAnalysis.adx14,
                        plus_di14: bbAnalysis.plus_di14,
                        minus_di14: bbAnalysis.minus_di14,
                        bb_state: bbAnalysis.state
                    };
                } catch (err) {
                    console.error(`Error processing ${symbol}`, err);
                    return null;
                }
            });

            const chunkResults = await Promise.all(promises);
            results.push(...chunkResults.filter(r => r !== null));

            // Minimize delay to speed up processing
            await new Promise(r => setTimeout(r, 10));
        }

        // 3. Write to Sheets
        const scanDate = new Date().toISOString().split('T')[0];
        await writeScanSnapshot({
            scan_date: scanDate,
            rows: results as any[]
        });

        // 4. Maintenance
        await cleanupOldSnapshots().catch((e: any) => console.error('Cleanup failed', e));

        // 5. Market Signal Alerts (New)
        try {
            const marketContext = await getMarketNews();

            const buySignals = results.filter(r =>
                r.ema200_macd_state === 'EMA200_MACD_BUY' &&
                r.bb_state === 'BB_BREAKOUT_BUY' &&
                (r.rsi || 0) > 60 // RSI > 60 xác nhận xung lực mạnh, gần vùng 70
            );

            const sellSignals = results.filter(r =>
                r.ema200_macd_state === 'EMA200_MACD_SELL' &&
                r.bb_state === 'BB_BREAKOUT_EXIT' &&
                (r.rsi || 0) < 40 // RSI < 40 xác nhận xu hướng giảm mạnh, gần vùng 30
            );

            const allSignals = [...buySignals, ...sellSignals];

            if (allSignals.length > 0) {
                console.log(`[Market Scan] Found ${allSignals.length} market signals. Sending alerts...`);

                for (const signal of allSignals) {
                    const news = await getSymbolNews(signal.symbol);
                    const aiAnalysis = await analyzeStockStrategyConcise({
                        symbol: signal.symbol,
                        close: signal.close,
                        indicators: {
                            rsi: { value: signal.rsi, state: signal.state },
                            ema_macd: { state: signal.ema200_macd_state, macd_hist: signal.macd_hist },
                            bb: { state: signal.bb_state, vol_ratio: signal.vol_ratio }
                        },
                        news: news,
                        marketContext: marketContext
                    });

                    const type = buySignals.includes(signal) ? '🟢 MUA MẠNH' : '🔴 BÁN MẠNH';
                    const message = `
<b>[TÍN HIỆU THỊ TRƯỜNG]</b>
Mã: <b>${signal.symbol}</b> - ${type}
Giá: ${signal.close.toLocaleString('vi-VN')}

<b>Phân tích kỹ thuật:</b>
- RSI: ${signal.rsi} (${signal.state})
- EMA/MACD: ${signal.ema200_macd_state}
- BB: ${signal.bb_state} (Vol: ${signal.vol_ratio}x)

<b>AI Phân tích:</b>
<i>${aiAnalysis}</i>
`.trim();

                    await sendTelegramMessage(message);
                }
            }
        } catch (alertErr) {
            console.error('[Market Scan] Alert processing failed:', alertErr);
        }

        // Log Success
        await supabase.from('jobs_log').update({
            status: 'OK',
            meta: {
                processed: results.length,
                total_symbols: symbols.length,
                duration: Date.now() - startTime
            }
        }).eq('id', logId);

        return { success: true, processed: results.length };

    } catch (error: any) {
        console.error('Job failed:', error);

        await supabase.from('jobs_log').update({
            status: 'FAILED',
            meta: { error: error.message }
        }).eq('id', logId);

        throw error;
    }
}
