/* eslint-disable @typescript-eslint/no-explicit-any */
import { OHLC } from './rsi';
import { createServiceClient } from './supabase-server';

// Fallback symbols if API fails
const FALLBACK_SYMBOLS = [
    'ACB', 'BCM', 'BID', 'BVH', 'CTG', 'FPT', 'GAS', 'GVR', 'HDB', 'HPG',
    'MBB', 'MSN', 'MWG', 'PLX', 'POW', 'SAB', 'SHB', 'SSB', 'SSI', 'STB',
    'TCB', 'TPB', 'VCB', 'VHM', 'VIB', 'VIC', 'VJC', 'VNM', 'VPB', 'VRE',
    'CEO', 'DIG', 'DXG', 'HQC', 'ITA', 'KBC', 'LPB', 'NVL', 'PDR', 'SHS', 'VND'
];

export async function getAllSymbols(): Promise<string[]> {
    // Try 1: VNDirect
    try {
        const res = await fetch('https://finfo-api.vndirect.com.vn/v4/stocks?q=type:stock,etf&size=2000', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
            const data = await res.json();
            if (data && data.data) {
                const symbols = data.data.map((s: any) => s.symbol);
                if (symbols.length > 50) return symbols;
            }
        }
    } catch (e) {
        console.warn('VNDirect fetch failed', e);
    }

    // Try 2: SSI (Older stable API)
    try {
        const res = await fetch('https://iboard.ssi.com.vn/dchart/api/1.1/default/get_all_stocks', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
            const data = await res.json(); // returns array of strings or objects? Usually text/plain with format.
            // Actually dchart api often returns complex format.
            // Let's stick to failover.
        }
    } catch (e) { }

    console.log('Using fallback symbol list');
    return FALLBACK_SYMBOLS;
}

export async function getSymbolHistory(symbol: string, days: number = 200): Promise<OHLC[]> {
    const to = Math.floor(Date.now() / 1000);
    const from = to - (days * 86400 * 1.5); // fetch a bit more to ensure trading days coverage

    // Entrade API
    const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${from}&to=${to}&symbol=${symbol}&resolution=1D`;

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

        const data = await res.json();
        if (data.c && data.t) {
            // Convert to OHLC array
            const ohlc: OHLC[] = [];
            for (let i = 0; i < data.t.length; i++) {
                ohlc.push({
                    t: data.t[i],
                    c: data.c[i]
                });
            }
            return ohlc;
        }
        return [];
    } catch (error) {
        console.error(`Error fetching history for ${symbol}:`, error);
        return [];
    }
}
