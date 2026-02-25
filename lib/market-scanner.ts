
import { createServiceClient } from '@/lib/supabase-server';
import crypto from 'crypto';
import { getAllSymbols, getSymbolHistory, getSymbolNews, getMarketNews } from '@/lib/market-data';
import { calculateRSIArray, analyzeRSI } from '@/lib/rsi';
import { analyzeEMAMACD, analyzeBBBreakout } from '@/lib/indicators';
import { writeScanSnapshot, cleanupOldSnapshots } from '@/lib/sheets-client';
import { analyzeStockStrategyConcise } from '@/lib/gemini';
import { sendTelegramMessage } from '@/lib/telegram';

// ─── Helper: Xác định tín hiệu 3 mẫu hình có đồng thuận không ─────────────
// BUY: RSI > 50, EMA/MACD = BUY, BB = BUY
// SELL: RSI < 50, EMA/MACD = SELL, BB = EXIT
function getConfluenceSignal(r: any): 'BUY' | 'SELL' | null {
    const rsiBuy = (r.rsi || 0) > 50;
    const rsiSell = (r.rsi || 0) < 50;
    const emaBuy = r.ema200_macd_state === 'EMA200_MACD_BUY';
    const emaSell = r.ema200_macd_state === 'EMA200_MACD_SELL';
    const bbBuy = r.bb_state === 'BB_BREAKOUT_BUY';
    const bbSell = r.bb_state === 'BB_BREAKOUT_EXIT';

    if (rsiBuy && emaBuy && bbBuy) return 'BUY';
    if (rsiSell && emaSell && bbSell) return 'SELL';
    return null;
}

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
        // 1. Lấy danh sách mã
        console.log('[Market Scan] Fetching symbols...');
        let symbols = await getAllSymbols();

        // Ưu tiên mã trong watchlist lên đầu
        const { data: watchlistData } = await supabase.from('watchlists').select('symbol');
        const watchlistSymbols = watchlistData ? watchlistData.map(w => w.symbol) : [];

        if (watchlistSymbols.length > 0) {
            const others = symbols.filter(s => !watchlistSymbols.includes(s));
            symbols = [...new Set([...watchlistSymbols, ...others])];
        }

        console.log(`[Market Scan] Found ${symbols.length} symbols to process`);

        const results = [];
        const CONCURRENCY = 50;
        const items = symbols;

        // 2. Quét kỹ thuật (không gọi AI ở bước này)
        for (let i = 0; i < items.length; i += CONCURRENCY) {
            if (Date.now() - startTime > 280000) {
                console.log('Time limit reached, stopping scan');
                break;
            }

            const chunk = items.slice(i, i + CONCURRENCY);
            const promises = chunk.map(async (symbol) => {
                try {
                    const history = await getSymbolHistory(symbol, 250);
                    if (history.length < 20) return null;

                    const closes = history.map(h => h.c);
                    const highs = history.map(h => h.h);
                    const lows = history.map(h => h.l);
                    const volumes = history.map(h => h.v);

                    // Bỏ qua mã không thanh khoản (trừ watchlist)
                    const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0);
                    if (recentVol === 0 && !watchlistSymbols.includes(symbol)) return null;

                    // Tính 3 mẫu hình kỹ thuật
                    const rsiSeries = calculateRSIArray(closes, 14);
                    const rsiAnalysis = analyzeRSI(rsiSeries);
                    const emaMacdAnalysis = analyzeEMAMACD(closes);
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
                        rsi: rsiAnalysis.value,
                        state: rsiAnalysis.state,
                        near_flag: rsiAnalysis.near_flag,
                        slope_5: rsiAnalysis.slope_5,
                        distance_to_30: rsiAnalysis.distance_to_30,
                        distance_to_70: rsiAnalysis.distance_to_70,
                        ema200: emaMacdAnalysis.ema200,
                        distance_to_ema200_pct: emaMacdAnalysis.distance_to_ema200_pct,
                        macd: emaMacdAnalysis.macd,
                        macd_signal: emaMacdAnalysis.macd_signal,
                        macd_hist: emaMacdAnalysis.macd_hist,
                        macd_cross: emaMacdAnalysis.macd_cross,
                        ema200_macd_state: emaMacdAnalysis.state,
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
            await new Promise(r => setTimeout(r, 10));
        }

        // 3. Ghi vào Google Sheets
        const scanDate = new Date().toISOString().split('T')[0];
        await writeScanSnapshot({ scan_date: scanDate, rows: results as any[] });
        await cleanupOldSnapshots().catch((e: any) => console.error('Cleanup failed', e));

        // 4. Lọc mã có TÍN HIỆU ĐỒNG THUẬN TỪ CẢ 3 MẪU HÌNH → Gửi Telegram + AI
        try {
            // Lọc mã đạt đồng thuận
            const confluenceSignals = results
                .map(r => ({ ...r, signal: getConfluenceSignal(r) }))
                .filter(r => r.signal !== null);

            if (confluenceSignals.length === 0) {
                console.log('[Market Scan] No confluence signals found. Skipping AI & Telegram.');
            } else {
                console.log(`[Market Scan] Found ${confluenceSignals.length} confluence signals (all 3 patterns agree). Processing AI analysis...`);

                // Lấy bối cảnh thị trường 1 lần
                const marketContext = await getMarketNews();

                // Xử lý tuần tự từng mã: lấy tin tức → gọi AI → GỬI (đảm bảo AI xong trước khi gửi)
                for (const signal of confluenceSignals) {
                    try {
                        const isBuy = signal.signal === 'BUY';
                        const type = isBuy ? '🟢 MUA MẠNH' : '🔴 BÁN MẠNH';

                        // Lấy tin tức mã
                        const news = await getSymbolNews(signal.symbol);
                        const newsStrings = news.map((n: any) => n.title || n);

                        // Gọi AI và ĐỢI KẾT QUẢ xong hoàn toàn trước khi gửi
                        console.log(`[Market Scan] Requesting AI for ${signal.symbol}...`);
                        const aiAnalysis = await analyzeStockStrategyConcise({
                            symbol: signal.symbol,
                            close: signal.close,
                            indicators: {
                                rsi: { value: signal.rsi, state: signal.state },
                                ema_macd: { state: signal.ema200_macd_state, macd_hist: signal.macd_hist },
                                bb: { state: signal.bb_state, vol_ratio: signal.vol_ratio }
                            },
                            news: newsStrings,
                            marketContext: marketContext
                        });

                        console.log(`[Market Scan] AI done for ${signal.symbol}. Sending Telegram...`);

                        // Bây giờ mới gửi Telegram (AI đã xong)
                        const message = `<b>[TÍN HIỆU ĐỒNG THUẬN 3 MẪU HÌNH]</b>
Mã: <b>${signal.symbol}</b> - ${type}
Giá: ${signal.close.toLocaleString('vi-VN')}

<b>Kỹ thuật (cả 3 đều xác nhận):</b>
- RSI: ${(signal.rsi || 0).toFixed(1)} (${signal.state})
- EMA/MACD: ${signal.ema200_macd_state}
- Bollinger: ${signal.bb_state} (Vol: ${(signal.vol_ratio || 0).toFixed(1)}x)

<b>🤖 Phân tích AI:</b>
<i>${aiAnalysis}</i>`.trim();

                        await sendTelegramMessage(message);
                        console.log(`[Market Scan] Telegram sent for ${signal.symbol} ✓`);

                    } catch (e) {
                        console.error(`[Market Scan] Alert failed for ${signal.symbol}:`, e);
                    }
                }
            }
        } catch (alertErr) {
            console.error('[Market Scan] Alert processing failed:', alertErr);
        }

        // 5. Log hoàn thành
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
