import { NextRequest, NextResponse } from 'next/server';
import { getSymbolNews } from '@/lib/market-data';
import { geminiModel } from '@/lib/gemini';
import { createServiceClient } from '@/lib/supabase-server';

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

        // Nếu là bài phân tích nội bộ → lấy sentiment thủ công đã lưu từ DB (chính xác hơn AI)
        const isInternalPost = latestNewsItem.link.startsWith('/analysis-posts');
        if (isInternalPost) {
            try {
                // Lấy ID từ cả hai dạng link: /analysis-posts/{id} và /analysis-posts?id={id}
                const postId = latestNewsItem.link.includes('?id=')
                    ? latestNewsItem.link.split('?id=')[1]
                    : latestNewsItem.link.replace('/analysis-posts/', '');

                const supabase = createServiceClient();
                const { data: post } = await supabase
                    .from('analysis_posts')
                    .select('sentiment')
                    .eq('id', postId)
                    .single();

                if (post?.sentiment) {
                    return NextResponse.json({ sentiment: post.sentiment, news: latestNewsItem });
                }
            } catch (dbErr) {
                console.warn('Could not fetch post sentiment from DB:', dbErr);
            }
        }

        // Với tin CafeF bên ngoài → dùng AI đánh giá
        const latestNewsText = news.slice(0, 3).map((n: { title: string; link: string }) => {
            const type = n.title.includes('[StockMonitor Analysis]') ? 'BÀI PHÂN TÍCH NỘI BỘ' : 'TIN TỨC CÔNG KHAI';
            return `${type}: ${n.title}`;
        }).join('\n');

        let sentiment = 'NEUTRAL';
        try {
            const prompt = `Bạn là chuyên gia chứng khoán am hiểu sâu sắc thị trường Việt Nam.
            Hãy đánh giá tác động của các tin tức sau đây đối với mã cổ phiếu ${symbol}.
            
            QUY TẮC PHÂN LOẠI CỰC KỲ NGHIÊM NGẶT:
            1. GOOD (TÍCH CỰC): Nếu tin báo lãi, tăng trưởng, kế hoạch mở rộng, trúng thầu, triển vọng tốt.
            2. BAD (TIÊU CỰC): Nếu tin báo lỗ, giảm lợi nhuận, tin xấu về ban lãnh đạo, rủi ro vĩ mô.
            3. NEUTRAL (TRUNG LẬP): Chỉ dùng cho tin thủ tục hành chính thuần túy.
            
            CHỈ TRẢ VỀ ĐÚNG 1 TỪ DUY NHẤT: GOOD, BAD, hoặc NEUTRAL.
            
            Dữ liệu đầu vào:
            ${latestNewsText}`;

            const result = await geminiModel.generateContent(prompt);
            const textRaw = await result.response.text();
            const text = textRaw.trim().toUpperCase();

            if (text.includes('GOOD')) {
                sentiment = 'GOOD';
            } else if (text.includes('BAD')) {
                sentiment = 'BAD';
            } else {
                sentiment = 'NEUTRAL';
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
