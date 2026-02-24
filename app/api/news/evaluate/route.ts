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
            const prompt = `Bạn là chuyên gia chứng khoán am hiểu sâu sắc thị trường Việt Nam.
            Hãy đánh giá tác động của các tin tức và bài phân tích sau đây đối với mã cổ phiếu ${symbol}.
            
            QUY TẮC PHÂN LOẠI:
            1. KHÁCH QUAN: Đánh giá dựa trên nội dung tiêu đề. Nếu tin mang lại triển vọng tăng trưởng, báo lãi, hoặc kế hoạch tích cực thì là GOOD. Nếu tin báo lỗ, giảm sút, rủi ro thì là BAD.
            2. KHÔNG PHÂN BIỆT NGUỒN TIN: Cả [BÀI PHÂN TÍCH NỘI BỘ] và [TIN TỨC CÔNG KHAI] đều phải được đánh giá dựa trên hướng tích cực/tiêu cực của chúng. Bài phân tích có thể cảnh báo rủi ro (BAD) hoặc triển vọng (GOOD).
            3. HẠN CHẾ TRUNG LẬP: Tránh chọn NEUTRAL tối đa. Chỉ chọn NEUTRAL khi tin hoàn toàn là thông tin hành chính không ảnh hưởng đến giá cổ phiếu.
            
            CHỈ TRẢ VỀ ĐÚNG 1 TỪ DUY NHẤT: GOOD, BAD, hoặc NEUTRAL.
            
            Dữ liệu đầu vào:
            ${latestNewsText}`;

            const result = await geminiModel.generateContent(prompt);
            const text = (await result.response.text()).trim().toUpperCase();

            if (text.includes('GOOD')) sentiment = 'GOOD';
            else if (text.includes('BAD')) sentiment = 'BAD';
            else sentiment = 'NEUTRAL';
        } catch (aiError) {
            console.error('AI Sentiment Error:', aiError);
        }

        return NextResponse.json({ sentiment, news: latestNewsItem });

    } catch (error) {
        console.error('Error evaluating news:', error);
        return NextResponse.json({ sentiment: 'NEUTRAL', news: null }, { status: 500 });
    }
}
