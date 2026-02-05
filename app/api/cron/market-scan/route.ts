import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';

import { getAllSymbols, getSymbolHistory } from '@/lib/market-data';
import { calculateRSIArray, analyzeRSI } from '@/lib/rsi';
import { analyzeEMAMACD } from '@/lib/indicators';
import { writeScanSnapshot } from '@/lib/sheets-client';

// Use Edge runtime if possible? Fetching 100s of requests might be better in Node with longer timeout.
// User didn't specify runtime. Default is Node.
// Set max duration for Vercel Pro
export const maxDuration = 300; // 300 seconds (Pro limit)

export async function GET(req: NextRequest) {
    // 1. Auth Check (CRON_SECRET)
    const authHeader = req.headers.get('authorization');
    const xCronSecret = req.headers.get('x-cron-secret');
    const secret = process.env.CRON_SECRET;

    if (!secret) {
        console.error('[Market Scan] CRON_SECRET is not configured on the server');
        return NextResponse.json({ error: 'Configuration Error' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${secret}` && xCronSecret !== secret) {
        console.error('[Market Scan] Unauthorized access attempt: Invalid token');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    const supabase = createServiceClient();

    // Log Start
    const logId = crypto.randomUUID();
    console.log(`[Market Scan] Starting job with ID: ${logId}`);

    const { error: logError } = await supabase.from('jobs_log').insert({
        id: logId,
        job_name: 'Market Scan',
        status: 'OK', // Using OK as placeholder since DB might require it, or just meta
        meta: { start_time: new Date().toISOString(), phase: 'STARTED' }
    });

    if (logError) {
        console.error('[Market Scan] Failed to create initial log:', logError);
    }

    try {
        // 2. Scan
        console.log('[Market Scan] Fetching symbols...');
        let symbols = await getAllSymbols();
        console.log(`[Market Scan] Found ${symbols.length} symbols to process`);

        const results = [];
        // Concurrency limit
        const CONCURRENCY = 15;
        const items = symbols;

        // Process in chunks
        for (let i = 0; i < items.length; i += CONCURRENCY) {
            // Check time left
            if (Date.now() - startTime > 280000) { // Safety margin at 280s for Vercel Pro
                console.log('Time limit reached, stopping scan');
                break;
            }

            const chunk = items.slice(i, i + CONCURRENCY);
            const promises = chunk.map(async (symbol) => {
                try {
                    // Fetch 300 candles for EMA200 + MACD stability
                    const history = await getSymbolHistory(symbol, 300);
                    if (history.length < 20) return null; // Not enough data

                    const closes = history.map(h => h.c);

                    // 1. RSI Logic
                    const rsiSeries = calculateRSIArray(closes, 14);
                    const rsiAnalysis = analyzeRSI(rsiSeries);

                    // 2. EMA200 + MACD Logic
                    const emaMacdAnalysis = analyzeEMAMACD(closes);

                    if (rsiAnalysis.value === null && emaMacdAnalysis.ema200 === null) return null;

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
                        ema200_macd_state: emaMacdAnalysis.state
                    };
                } catch (err) {
                    console.error(`Error processing ${symbol}`, err);
                    return null;
                }
            });

            const chunkResults = await Promise.all(promises);
            results.push(...chunkResults.filter(r => r !== null));

            // Smaller delay for speed
            await new Promise(r => setTimeout(r, 50));
        }

        // 3. Write to Sheets
        const scanDate = new Date().toISOString().split('T')[0];
        await writeScanSnapshot({
            scan_date: scanDate,
            rows: results as any[]
        });

        // Log Success
        await supabase.from('jobs_log').update({
            status: 'OK',
            meta: {
                processed: results.length,
                total_symbols: symbols.length,
                duration: Date.now() - startTime
            }
        }).eq('id', logId);

        return NextResponse.json({ success: true, processed: results.length });

    } catch (error: any) {
        console.error('Job failed:', error);

        await supabase.from('jobs_log').update({
            status: 'FAILED',
            meta: { error: error.message }
        }).eq('id', logId);

        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
