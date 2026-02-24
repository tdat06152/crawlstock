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

        const latestNewsItem = news[0];
        const latestNewsText = news.slice(0, 3).map(n => {
            const type = n.title.includes('[StockMonitor Analysis]') ? 'BÀI PHÂN TÍCH NỘI BỘ' : 'TIN TỨC CÔNG KHAI';
            return `${type}: ${n.title}`;
        }).join('\n');

        let sentiment = 'NEUTRAL';
        try {
            // Đánh giá NLP xem tin tốt hay xấu
            const prompt = `Bạn là chuyên gia chứng khoán. Hãy đánh giá tin tức sau đối với cổ phiếu ${symbol} dựa trên thực tế thị trường Việt Nam.
            Ghi chú: [BÀI PHÂN TÍCH NỘI BỘ] là do các chuyên gia của chúng tôi viết nên có độ tin cậy cao nhất.
            
            Chỉ trả về đúng 1 từ duy nhất: GOOD (nếu tin tích cực/triển vọng), BAD (nếu tin xấu/lỗ/tiền trọng), hoặc NEUTRAL (trung tính).
            
            Các tin tức/phân tích gần đây:
            ${latestNewsText}`;

            const result = await geminiModel.generateContent(prompt);
            const text = (await result.response.text()).trim().toUpperCase();

            if (text.includes('GOOD')) sentiment = 'GOOD';
            else if (text.includes('BAD')) sentiment = 'BAD';
        } catch (aiError) {
            console.error('AI Sentiment Error:', aiError);
        }

        return NextResponse.json({ sentiment, news: latestNewsItem });

    } catch (error) {
        console.error('Error evaluating news:', error);
        return NextResponse.json({ sentiment: 'NEUTRAL', news: null }, { status: 500 });
    }
}
