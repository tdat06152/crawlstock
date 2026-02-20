
interface SheetSnapshot {
    scan_date: string;
    rows: Array<{
        symbol: string;
        close: number;
        rsi: number;
        state: string;
        near_flag: string;
        slope_5: number | null;
        distance_to_30: number | null;
        distance_to_70: number | null;
        ema200: number | null;
        distance_to_ema200_pct: number | null;
        macd: number | null;
        macd_signal: number | null;
        macd_hist: number | null;
        macd_cross: string;
        ema200_macd_state: string;
        // BB fields
        bb_mid: number | null;
        bb_upper: number | null;
        bb_lower: number | null;
        bb_bandwidth_pct: number | null;
        vol: number | null;
        vol_ma20: number | null;
        vol_ratio: number | null;
        adx14: number | null;
        plus_di14: number | null;
        minus_di14: number | null;
        bb_state: string;
    }>;
}

export async function writeScanSnapshot(snapshot: SheetSnapshot) {
    const url = process.env.GOOGLE_SHEETS_SCRIPT_URL;
    const key = process.env.GOOGLE_SHEETS_API_KEY;

    if (!url) {
        throw new Error('GOOGLE_SHEETS_SCRIPT_URL is missing in environment variables');
    }
    if (!key) {
        throw new Error('GOOGLE_SHEETS_API_KEY is missing in environment variables');
    }

    // Batch in chunks if necessary, but Apps Script limit is 50MB payload, so 2000 rows is fine.
    // We need to pass the key.

    const payload = {
        action: 'writeScanSnapshot',
        key: key,
        scan_date: snapshot.scan_date,
        rows: snapshot.rows
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data && data.error) {
        throw new Error(`Sheets Script Error: ${data.error}`);
    }
    return data;
}

// Simple in-memory cache to avoid repeated slow Sheets calls
const snapshotCache: Record<string, { data: any[], timestamp: number }> = {};
const CACHE_TTL = 3600 * 1000; // 1 hour

export async function getScanSnapshot(date: string) {
    const now = Date.now();
    if (snapshotCache[date] && (now - snapshotCache[date].timestamp < CACHE_TTL)) {
        console.log(`[Sheets] Returning cached snapshot for ${date}`);
        return snapshotCache[date].data;
    }

    const url = process.env.GOOGLE_SHEETS_SCRIPT_URL;
    const key = process.env.GOOGLE_SHEETS_API_KEY;

    if (!url || !key) return [];

    const targetUrl = new URL(url);
    targetUrl.searchParams.append('action', 'getScanSnapshot');
    targetUrl.searchParams.append('date', date);
    targetUrl.searchParams.append('key', key);

    const res = await fetch(targetUrl.toString());
    if (!res.ok) throw new Error(`Sheets API read error: ${res.status}`);

    const data = await res.json();
    const items = data.items || [];

    // Cache result
    snapshotCache[date] = { data: items, timestamp: now };

    return items;
}

export async function cleanupOldSnapshots() {
    const url = process.env.GOOGLE_SHEETS_SCRIPT_URL;
    const key = process.env.GOOGLE_SHEETS_API_KEY;

    if (!url || !key) return;

    const payload = {
        action: 'cleanupOldSnapshots',
        key: key
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    return res.json();
}
