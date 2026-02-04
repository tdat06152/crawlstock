
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
    }>;
}

export async function writeScanSnapshot(snapshot: SheetSnapshot) {
    const url = process.env.GOOGLE_SHEETS_SCRIPT_URL;
    const key = process.env.GOOGLE_SHEETS_API_KEY;

    if (!url || !key) {
        throw new Error('Google Sheets config missing');
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

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Sheets API error: ${res.status} - ${text}`);
    }

    return res.json();
}

export async function getScanSnapshot(date: string) {
    const url = process.env.GOOGLE_SHEETS_SCRIPT_URL;
    const key = process.env.GOOGLE_SHEETS_API_KEY;

    if (!url || !key) return [];

    const targetUrl = new URL(url);
    targetUrl.searchParams.append('action', 'getScanSnapshot');
    targetUrl.searchParams.append('date', date);
    targetUrl.searchParams.append('key', key);

    // Note: Apps Script Web App redirects (302) to googleusercontent.
    // fetch follows redirects by default.

    const res = await fetch(targetUrl.toString());
    if (!res.ok) throw new Error(`Sheets API read error: ${res.status}`);

    const data = await res.json();
    return data.items || [];
}
