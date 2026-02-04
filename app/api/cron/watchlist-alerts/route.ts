
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getScanSnapshot } from '@/lib/sheets-client';

export const maxDuration = 60;

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
        // 1. Get Latest Scan Snapshot
        const today = new Date().toISOString().split('T')[0];
        // Try getting today's snapshot, if empty try yesterday?
        let scanResults = await getScanSnapshot(today);
        if (!scanResults || scanResults.length === 0) {
            // Try yesterday
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            scanResults = await getScanSnapshot(yesterday);
        }

        if (!scanResults || scanResults.length === 0) {
            throw new Error('No scan results found');
        }

        // Index scan results by symbol for fast lookup
        const marketMap = new Map();
        scanResults.forEach((item: any) => {
            marketMap.set(item.symbol, item);
        });

        // 2. Get Users and Watchlists
        // Fetch users who have alerts enabled
        const { data: settings } = await supabase
            .from('user_scan_settings')
            .select('*')
            .eq('enable_alerts', true);

        // Fetch ALL watchlist items with user_id
        const { data: items } = await supabase
            .from('watchlist_items')
            .select('symbol, watchlist_id, watchlists!inner(user_id)');

        if (!items) return NextResponse.json({ processed: 0 });

        const alertsToInsert: any[] = [];
        const seenAlerts = new Set(); // avoid duplicates for same user-symbol

        for (const item of items) {
            const symbol = item.symbol;
            // Handle potentially array result from Join
            const watchlistData: any = item.watchlists;
            const userId = Array.isArray(watchlistData) ? watchlistData[0]?.user_id : watchlistData?.user_id;

            if (!userId) continue;

            // Get user settings or defaults
            const userSetting = settings?.find((s: any) => s.user_id === userId) || {
                overbought: 70,
                oversold: 30,
                near_overbought_from: 65,
                near_oversold_to: 35
            };

            const marketData = marketMap.get(symbol);
            if (!marketData) continue;

            // Check conditions
            let alertState = null;
            let message = '';

            const rsi = marketData.rsi;
            const slope = marketData.slope_5;

            if (rsi < userSetting.oversold) {
                alertState = 'OVERSOLD';
                message = `RSI ${rsi} (Quá bán). Momentum: ${slope}`;
            } else if (rsi > userSetting.overbought) {
                alertState = 'OVERBOUGHT';
                message = `RSI ${rsi} (Quá mua). Momentum: ${slope}`;
            } else if (rsi <= userSetting.near_oversold_to && rsi > userSetting.oversold) {
                alertState = 'NEAR_OVERSOLD';
                message = `Tiệm cận vùng quá bán (${rsi})`;
            } else if (rsi >= userSetting.near_overbought_from && rsi < userSetting.overbought) {
                alertState = 'NEAR_OVERBOUGHT';
                message = `Tiệm cận vùng quá mua (${rsi})`;
            }

            if (alertState) {
                // Slope Logic: "Oversold + slope tăng" => Actionable
                if (slope > 0 && (alertState === 'OVERSOLD' || alertState === 'NEAR_OVERSOLD')) {
                    message += " [TÍN HIỆU HỒI PHỤC]";
                }

                const key = `${userId}-${symbol}-${marketData.scan_date}-${alertState}`;
                if (!seenAlerts.has(key)) {
                    alertsToInsert.push({
                        user_id: userId,
                        symbol: symbol,
                        scan_date: marketData.scan_date || today,
                        rsi: rsi,
                        state: alertState,
                        slope_5: slope,
                        message: message,
                        is_sent: false
                    });
                    seenAlerts.add(key);
                }
            }
        }

        if (alertsToInsert.length > 0) {
            // Upsert to avoid dupes constraint
            const { error } = await supabase.from('alerts').upsert(alertsToInsert, {
                onConflict: 'user_id, symbol, scan_date, state'
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
