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
            Hãy đánh giá tác động của các tin tức/bài phân tích sau đối với mã cổ phiếu ${symbol}.
            
            QUY TẮC PHÂN LOẠI:
            1. [BÀI PHÂN TÍCH NỘI BỘ]: Đây là thông tin có trọng số cao nhất. Nếu tiêu đề mang tính chất kỳ vọng, tăng trưởng hoặc giải quyết nút thắt -> GOOD.
            2. [TIN TỨC CÔNG KHAI]: Đánh giá dựa trên triển nhuận và dòng tiền.
            3. HẠN CHẾ TRUNG LẬP: Tránh chọn NEUTRAL. Chỉ chọn NEUTRAL nếu tin hoàn toàn là thủ tục hành chính vô thưởng vô phạt. Nếu tin có bất kỳ ẩn ý nào về sự thay đổi vị thế của doanh nghiệp, hãy chọn GOOD hoặc BAD.
            
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
