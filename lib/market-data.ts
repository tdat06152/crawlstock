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

let symbolsCache: { data: string[], timestamp: number } | null = null;

export async function getAllSymbols(): Promise<string[]> {
    const now = Date.now();
    if (symbolsCache && (now - symbolsCache.timestamp < 3600 * 1000)) {
        return symbolsCache.data;
    }

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
                if (symbols.length > 50) {
                    symbolsCache = { data: symbols, timestamp: now };
                    return symbols;
                }
            }
        }
    } catch (e) {
        console.warn('VNDirect fetch failed', e);
    }

    // Try 2: SSI (Older stable API) - omitted for brevity in cache but logic remains
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
                    o: data.o ? data.o[i] : data.c[i],
                    c: data.c[i],
                    h: data.h ? data.h[i] : data.c[i],
                    l: data.l ? data.l[i] : data.c[i],
                    v: data.v ? data.v[i] : 0
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

export async function getSymbolNews(symbol: string): Promise<{ title: string, link: string }[]> {
    const fetchCafeF = async () => {
        try {
            const res = await fetch(`https://cafef.vn/du-lieu/Ajax/Events_RelatedNews_New.aspx?symbol=${symbol}&PageSize=5&PageIndex=1`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                next: { revalidate: 1800 }
            });
            if (res.ok) {
                const html = await res.text();
                // Improved regex to handle different attribute orders
                const news: { title: string, link: string }[] = [];
                const itemRegex = /<a[^>]+class='docnhanhTitle'[^>]*>([\s\S]*?)<\/a>/g;
                let itemMatch;

                while ((itemMatch = itemRegex.exec(html)) !== null) {
                    const itemHtml = itemMatch[0];
                    const hrefMatch = /href="([^"]+)"/.exec(itemHtml);
                    const titleMatch = /title="([^"]+)"/.exec(itemHtml);

                    if (hrefMatch && titleMatch) {
                        const title = titleMatch[1].trim();
                        const link = hrefMatch[1].startsWith('http') ? hrefMatch[1] : `https://cafef.vn${hrefMatch[1]}`;
                        if (!news.some(n => n.title === title)) {
                            news.push({ title, link });
                        }
                    }
                }
                return news.slice(0, 5);
            }
        } catch (e) {
            console.warn(`CafeF news failed for ${symbol}`, e);
        }
        return [];
    };

    const fetchAnalysisPosts = async () => {
        try {
            const supabase = createServiceClient();
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

            const { data, error } = await supabase
                .from('analysis_posts')
                .select('title, created_at, id')
                .ilike('symbol', `%${symbol}%`)
                .gte('created_at', fourteenDaysAgo.toISOString())
                .order('created_at', { ascending: false })
                .limit(2);

            if (data && !error) {
                return data.map((item: any) => ({
                    title: `[StockMonitor Analysis] ${item.title} (${new Date(item.created_at).toLocaleDateString('vi-VN')})`,
                    link: `/analysis-posts/${item.id}`
                }));
            }
        } catch (e) {
            console.warn(`Analysis posts fetch failed for ${symbol}`, e);
        }
        return [];
    };

    const [cafeFNews, analysisPosts] = await Promise.all([
        fetchCafeF(),
        fetchAnalysisPosts()
    ]);

    const news = [...analysisPosts, ...cafeFNews];
    const uniqueNews: { title: string, link: string }[] = [];
    const titles = new Set();
    for (const item of news) {
        if (!titles.has(item.title)) {
            uniqueNews.push(item);
            titles.add(item.title);
        }
    }
    return uniqueNews.slice(0, 5);
}

export async function getSymbolNewsLegacy(symbol: string): Promise<string[]> {
    const news = await getSymbolNews(symbol);
    return news.map(n => n.title);
}

export async function getMarketNews(): Promise<string[]> {
    try {
        const query = encodeURIComponent('chứng khoán Việt Nam');
        const url = `https://news.google.com/rss/search?q=${query}&hl=vi&gl=VN&ceid=VN:vi`;

        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 3600 }
        });

        if (res.ok) {
            const rssText = await res.text();
            const titles: string[] = [];

            // Extract titles using regex
            const regex = /<title>(.*?)<\/title>/g;
            let match;

            while ((match = regex.exec(rssText)) !== null) {
                const title = match[1];
                // Skip generic titles
                if (title &&
                    title !== 'Google News' &&
                    title !== 'Google Tin tức' &&
                    !title.includes('Google Tin tức') &&
                    !title.startsWith('“') &&
                    !title.startsWith('"')) {
                    titles.push(title);
                }
            }

            return titles.slice(0, 10);
        }
    } catch (e) {
        console.warn('Market news fetch failed', e);
    }
    return [];
}
