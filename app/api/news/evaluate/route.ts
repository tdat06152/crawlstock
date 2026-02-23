import { NextRequest, NextResponse } from 'next/server';
import { getSymbolNews } from '@/lib/market-data';
import { geminiModel } from '@/lib/gemini';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
    }

    try {
        const news = await getSymbolNews(symbol);
        if (!news || news.length === 0) {
            return NextResponse.json({ sentiment: 'NEUTRAL', news: null });
        }

        // Lấy tin tức mới nhất hoặc gộp 2 tin
        const latestNews = news.slice(0, 2).join(' | ');

        // Đánh giá NLP xem tin tốt hay xấu
        const prompt = `Đánh giá tin tức sau đối với cổ phiếu ${symbol} (Chỉ trả về đúng 1 từ: GOOD, BAD, hoặc NEUTRAL):
        Tin tức: "${latestNews}"`;

        // Sử dụng model có sẵn
        const result = await geminiModel.generateContent(prompt);
        const text = (await result.response.text()).trim().toUpperCase();

        let sentiment = 'NEUTRAL';
        if (text.includes('GOOD')) sentiment = 'GOOD';
        if (text.includes('BAD')) sentiment = 'BAD';

        return NextResponse.json({ sentiment, news: news[0] });

    } catch (error) {
        console.error('Error evaluating news:', error);
        return NextResponse.json({ sentiment: 'NEUTRAL', news: null }, { status: 500 });
    }
}
