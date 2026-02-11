import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
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
        // 1. Fetch history (enough for stable indicators + 7 days for report)
        const history = await getSymbolHistory(symbol, 250);
        if (history.length === 0) {
            return NextResponse.json({ error: 'No data found for symbol' }, { status: 404 });
        }

        const last7Days = history.slice(-7);
        const closes = history.map(h => h.c);
        const highs = history.map(h => h.h);
        const lows = history.map(h => h.l);
        const volumes = history.map(h => h.v);

        // 2. Calculate Indicators (using the logic from market-scan)
        const rsiSeries = calculateRSIArray(closes, 14);
        const rsiAnalysis = analyzeRSI(rsiSeries);
        const emaMacdAnalysis = analyzeEMAMACD(closes);
        const bbAnalysis = analyzeBBBreakout(highs, lows, closes, volumes);

        // 3. Fetch News
        const news = await getSymbolNews(symbol);
        if (news.length === 0) {
            news.push(`Diễn biến giá ${symbol} trong tuần qua từ ${last7Days[0].c} đến ${last7Days[6].c}`);
            news.push(`Khối lượng giao dịch trung bình đạt ${Math.round(volumes.slice(-7).reduce((a, b) => a + b, 0) / 7)} đơn vị/phiên.`);
        }

        // 4. Run Gemini Analysis
        const analysis = await analyzeStockStrategy({
            symbol,
            period: '1 tuần gần nhất',
            prices: last7Days.map(d => ({
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
            news
        });

        return NextResponse.json({ symbol, analysis });

    } catch (error: any) {
        console.error('Analysis Route Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
