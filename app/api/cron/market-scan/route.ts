
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

import { getAllSymbols, getSymbolHistory } from '@/lib/market-data';
import { calculateRSIArray, analyzeRSI } from '@/lib/rsi';
import { writeScanSnapshot } from '@/lib/sheets-client';

// Use Edge runtime if possible? Fetching 100s of requests might be better in Node with longer timeout.
// User didn't specify runtime. Default is Node.
// Set max duration for Vercel Pro
export const maxDuration = 60; // 60 seconds (Hobby limit usually 10s, Pro 300s). 
// Attempt to run as long as possible.

export async function GET(req: NextRequest) {
    // 1. Auth Check (CRON_SECRET)
    const authHeader = req.headers.get('authorization');
    const xCronSecret = req.headers.get('x-cron-secret');
    const secret = process.env.CRON_SECRET;

    if (authHeader !== `Bearer ${secret}` && xCronSecret !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    const supabase = createServiceClient();

    // Log Start
    const logId = crypto.randomUUID();
    await supabase.from('jobs_log').insert({
        id: logId,
        job_name: 'Market Scan',
        status: 'RUNNING',
        meta: { start_time: new Date().toISOString() }
    });

    try {
        // 2. Scan
        // Limit symbols for safety unless we have a robust queue
        let symbols = await getAllSymbols();

        // Shuffle or limit?
        // For now, let's take first 200 or so to avoid timeout in Vercel Free tier.
        // If user has Pro, they can increase this.
        // To support "Toàn thị trường" (All Market), we need a loop that checks time remnants.

        // For this demo, let's cap at 100 to ensure success.
        // NOTE: User asked for "Toàn thị trường". I will try to process as many as possible.

        const results = [];
        // Concurrency limit
        const CONCURRENCY = 10;
        const items = symbols; // .slice(0, 100); 

        // Process in chunks
        for (let i = 0; i < items.length; i += CONCURRENCY) {
            // Check time left (Serverless timeout usually hard kill)
            if (Date.now() - startTime > 50000) { // Safety margin at 50s
                console.log('Time limit reached, stopping scan');
                break;
            }

            const chunk = items.slice(i, i + CONCURRENCY);
            const promises = chunk.map(async (symbol) => {
                try {
                    const history = await getSymbolHistory(symbol, 200);
                    if (history.length < 15) return null; // Not enough data

                    const closes = history.map(h => h.c);
                    const rsiSeries = calculateRSIArray(closes, 14);
                    const analysis = analyzeRSI(rsiSeries);

                    if (analysis.value === null) return null;

                    return {
                        symbol,
                        close: closes[closes.length - 1],
                        rsi: analysis.value,
                        state: analysis.state,
                        near_flag: analysis.near_flag,
                        slope_5: analysis.slope_5,
                        distance_to_30: analysis.distance_to_30,
                        distance_to_70: analysis.distance_to_70
                    };
                } catch (err) {
                    console.error(`Error processing ${symbol}`, err);
                    return null;
                }
            });

            const chunkResults = await Promise.all(promises);
            results.push(...chunkResults.filter(r => r !== null));

            // Small delay to be nice to API
            await new Promise(r => setTimeout(r, 100));
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
