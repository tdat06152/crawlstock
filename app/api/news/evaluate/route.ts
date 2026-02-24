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
            
            QUY TẮC PHÂN LOẠI CỰC KỲ NGHIÊM NGẶT:
            1. GOOD (TÍCH CỰC): Nếu tin báo lãi, tăng trưởng, kế hoạch mở rộng, trúng thầu, triển vọng tốt, hoặc bài phân tích khen ngợi tiềm năng (như "kỷ nguyên vươn mình", "thăng hoa", "hồi phục").
            2. BAD (TIÊU CỰC): Nếu tin báo lỗ, giảm lợi nhuận, tin xấu về ban lãnh đạo, rủi ro vĩ mô, hoặc bài phân tích cảnh báo nguy cơ.
            3. NEUTRAL (TRUNG LẬP): Chỉ dùng cho tin thủ tục hành chính thuần túy (như báo cáo tình hình quản trị thường niên, thông báo ngày chốt danh sách họp mà không có nội dung gì thêm).
            
            HẠN CHẾ TRUNG LẬP: Nếu bài viết là PHÂN TÍCH (Analysis), gần như chắc chắn nó phải là GOOD hoặc BAD. Hãy đọc kỹ nội dung để cảm nhận tông giọng của người viết.
            
            CHỈ TRẢ VỀ ĐÚNG 1 TỪ DUY NHẤT: GOOD, BAD, hoặc NEUTRAL.
            
            Dữ liệu đầu vào:
            ${latestNewsText}`;

            const result = await geminiModel.generateContent(prompt);
            const textRaw = await result.response.text();
            const text = textRaw.trim().toUpperCase();

            // Phân loại dựa trên kết quả AI
            if (text.includes('GOOD')) {
                sentiment = 'GOOD';
            } else if (text.includes('BAD')) {
                sentiment = 'BAD';
            } else {
                // Fallback nếu AI trả về trung lập cho bài phân tích tích cực
                if (latestNewsText.toLowerCase().includes('vươn mình') ||
                    latestNewsText.toLowerCase().includes('triển vọng') ||
                    latestNewsText.toLowerCase().includes('tăng trưởng')) {
                    sentiment = 'GOOD';
                } else {
                    sentiment = 'NEUTRAL';
                }
            }
        } catch (aiError) {
            console.error('AI Sentiment Error:', aiError);
        }

        return NextResponse.json({ sentiment, news: latestNewsItem });

    } catch (error) {
        console.error('Error evaluating news:', error);
        return NextResponse.json({ sentiment: 'NEUTRAL', news: null }, { status: 500 });
    }
}
