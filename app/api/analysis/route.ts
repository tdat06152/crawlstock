import { NextRequest, NextResponse } from 'next/server';
import { getSymbolHistory, getSymbolNews } from '@/lib/market-data';
import { calculateRSIArray, analyzeRSI } from '@/lib/rsi';
import { analyzeEMAMACD, analyzeBBBreakout } from '@/lib/indicators';
import { analyzeStockStrategy } from '@/lib/gemini';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
    }

    try {
        // 1. Lấy lịch sử giá và tin tức song song
        // Lấy 300 nến để đủ EMA200, tin tức 14 ngày gần nhất
        const [history, fetchedNews] = await Promise.all([
            getSymbolHistory(symbol, 300),
            getSymbolNews(symbol) // đã mặc định lấy 14 ngày gần nhất
        ]);

        if (history.length === 0) {
            return NextResponse.json({ error: 'No data found for symbol' }, { status: 404 });
        }

        const closes = history.map(h => h.c);
        const highs = history.map(h => h.h);
        const lows = history.map(h => h.l);
        const volumes = history.map(h => h.v);
        const last5Days = history.slice(-5);

        // 2. Tính 3 mẫu hình kỹ thuật
        const rsiSeries = calculateRSIArray(closes, 14);
        const rsiAnalysis = analyzeRSI(rsiSeries);
        const emaMacdAnalysis = analyzeEMAMACD(closes);
        const bbAnalysis = analyzeBBBreakout(highs, lows, closes, volumes);

        // 3. Chuẩn bị tin tức (tiêu đề bài viết 14 ngày)
        let newsStrings: string[] = fetchedNews.map((n: any) => n.title || String(n));
        if (newsStrings.length === 0) {
            newsStrings.push(`Không có tin tức mới trong 14 ngày qua cho mã ${symbol}.`);
        }

        // 4. Gọi Gemini AI phân tích
        const analysis = await analyzeStockStrategy({
            symbol,
            period: '5 phiên gần nhất',
            prices: last5Days.map(d => ({
                date: new Date(d.t * 1000).toLocaleDateString('vi-VN'),
                close: d.c,
                high: d.h,
                low: d.l,
                vol: d.v
            })),
            indicators: {
                rsi: rsiAnalysis,
                ema_macd: emaMacdAnalysis,
                bollinger: bbAnalysis
            },
            news: newsStrings
        });

        return NextResponse.json({ symbol, analysis });

    } catch (error: any) {
        console.error('Analysis Route Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
