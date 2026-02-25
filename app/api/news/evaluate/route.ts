import { NextRequest, NextResponse } from 'next/server';
import { getSymbolNews } from '@/lib/market-data';
import { geminiModel } from '@/lib/gemini';
import { createServiceClient } from '@/lib/supabase-server';

// ─── In-memory cache (30 min TTL) to reduce Gemini API calls ───────────────
interface CacheEntry {
    sentiment: string;
    news: { title: string; link: string } | null;
    expiresAt: number;
}
const sentimentCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCached(symbol: string): CacheEntry | null {
    const entry = sentimentCache.get(symbol);
    if (entry && Date.now() < entry.expiresAt) return entry;
    sentimentCache.delete(symbol);
    return null;
}
function setCache(symbol: string, sentiment: string, news: { title: string; link: string } | null) {
    sentimentCache.set(symbol, { sentiment, news, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Keyword-based fallback sentiment when AI is unavailable.
 */
function keywordSentiment(text: string): 'GOOD' | 'BAD' | 'NEUTRAL' {
    const lower = text.toLowerCase();
    const goodKeywords = [
        'tăng trưởng', 'lợi nhuận', 'doanh thu tăng', 'trúng thầu', 'hợp đồng lớn',
        'kết quả tốt', 'phục hồi', 'bứt phá', 'bùng nổ', 'kỷ lục', 'vượt kế hoạch',
        'tích cực', 'khả quan', 'bốc đầu', 'tăng mạnh', 'hồi phục', 'cổ tức cao',
        'chia cổ tức', 'mở rộng', 'đột biến', 'tăng vốn thành công', 'thắng lợi',
    ];
    const badKeywords = [
        'thua lỗ', 'lỗ', 'giảm mạnh', 'sụt giảm', 'bị bắt', 'khởi tố', 'điều tra',
        'vi phạm', 'bị phạt', 'nợ xấu', 'vỡ nợ', 'phá sản', 'dừng hoạt động',
        'tiêu cực', 'rủi ro', 'giảm lợi nhuận', 'doanh thu giảm', 'khó khăn',
        'thách thức lớn', 'cảnh báo', 'nguy cơ', 'thoái vốn bất lợi',
    ];

    let goodScore = 0;
    let badScore = 0;
    for (const kw of goodKeywords) if (lower.includes(kw)) goodScore++;
    for (const kw of badKeywords) if (lower.includes(kw)) badScore++;

    if (goodScore > badScore) return 'GOOD';
    if (badScore > goodScore) return 'BAD';
    return 'NEUTRAL';
}

/**
 * Fetch and extract readable text from a Vietnamese news article URL.
 */
async function fetchArticleContent(url: string): Promise<string> {
    try {
        if (!url.startsWith('http')) return '';
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            signal: AbortSignal.timeout(7000),
        });
        if (!res.ok) return '';
        const html = await res.text();

        // Extract article body
        let text = '';
        const contentMatch =
            /<div[^>]+id="[^"]*chi-tiet-noi-dung[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html) ||
            /<div[^>]+class="[^"]*detail-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html) ||
            /<div[^>]+class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html) ||
            /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html);

        text = contentMatch ? contentMatch[1] : html;

        text = text
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<div[^>]+class="[^"]*link-content-footer[^"]*"[\s\S]*?<\/div>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\s{2,}/g, ' ')
            .trim();

        return text.slice(0, 2500);
    } catch {
        return '';
    }
}

/**
 * Call Gemini with retry logic.
 */
async function callGeminiWithRetry(prompt: string, maxRetries = 1): Promise<string> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await geminiModel.generateContent(prompt);
            return await result.response.text();
        } catch (err: any) {
            const msg = err.message || String(err);
            if (msg.includes('429') && !msg.includes('PerDayPerProject') && attempt < maxRetries) {
                const delay = 5000;
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw err;
        }
    }
    throw new Error('Max retries exceeded');
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
    }

    const cached = getCached(symbol);
    if (cached) {
        return NextResponse.json({ sentiment: cached.sentiment, news: cached.news, cached: true });
    }

    try {
        const news = await getSymbolNews(symbol);
        if (!news || news.length === 0) {
            setCache(symbol, 'NEUTRAL', null);
            return NextResponse.json({ sentiment: 'NEUTRAL', news: null });
        }

        const latestNewsItem = news[0];

        // 1. Internal analysis posts
        const isInternalPost = latestNewsItem.link.startsWith('/analysis-posts');
        if (isInternalPost) {
            try {
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
                    setCache(symbol, post.sentiment, latestNewsItem);
                    return NextResponse.json({ sentiment: post.sentiment, news: latestNewsItem });
                }
            } catch (dbErr) {
                console.warn('Could not fetch post sentiment from DB:', dbErr);
            }
        }

        // 2. External news: Only evaluate the LATEST news article to match what is displayed in the UI.
        // This prevents the AI from evaluating older "BAD" news when the UI shows a new "GOOD" headline.
        const latestExternalNews = latestNewsItem.link.startsWith('http') ? latestNewsItem : news.find(n => n.link.startsWith('http'));

        let articleContentText = '(Không có nội dung chi tiết)';
        if (latestExternalNews) {
            const content = await fetchArticleContent(latestExternalNews.link);
            articleContentText = content || '(Không trích xuất được nội dung bài báo, chỉ dựa vào tiêu đề)';
        }

        let sentiment = 'NEUTRAL';
        try {
            const prompt = `Bạn là một chuyên gia phân tích chứng khoán Việt Nam hàng đầu. 
Nhiệm vụ: Đọc và phân tích bài báo MỚI NHẤT dưới đây để đánh giá sắc thái ảnh hưởng ngắn hạn của nó đối với cổ phiếu ${symbol}.

QUY TẮC PHÂN LOẠI:
1. [GOOD]: Tin tức mang tính tích cực (Ví dụ: lợi nhuận tăng, "bốc đầu", được cấp margin, cổ tức cao, trúng thầu, kế hoạch kinh doanh tham vọng).
2. [BAD]: Tin tức mang tính tiêu cực (Ví dụ: "bốc hơi" lợi nhuận/vốn hóa, lỗ nặng, lãnh đạo vi phạm, nợ xấu, cắt margin).
3. [NEUTRAL]: Thủ tục hành chính, nghị quyết ĐHCĐ thông thường, các nghiệp vụ ngân hàng thông thường (như BID thông qua hợp đồng/giao dịch cấp tín dụng - đây là việc kinh doanh rất bình thường của Bank).

BÀI BÁO CẦN ĐÁNH GIÁ:
Tiêu đề: ${latestExternalNews?.title || latestNewsItem.title}
Nội dung: ${articleContentText}

YÊU CẦU: Chỉ trả về 1 từ duy nhất (GOOD, BAD hoặc NEUTRAL). Không giải thích gì thêm.`.trim();

            const textRaw = await callGeminiWithRetry(prompt);
            const text = textRaw.trim().toUpperCase();

            if (/\bGOOD\b/.test(text)) sentiment = 'GOOD';
            else if (/\bBAD\b/.test(text)) sentiment = 'BAD';
            else sentiment = 'NEUTRAL';

            console.log(`[News Sentiment AI] ${symbol}: ${sentiment} (Raw: "${text}")`);
        } catch (aiError) {
            console.error(`AI error for ${symbol}:`, aiError);
            sentiment = keywordSentiment(news.map(n => n.title).join(' '));
        }

        setCache(symbol, sentiment, latestNewsItem);
        return NextResponse.json({ sentiment, news: latestNewsItem });

    } catch (error) {
        console.error('Error evaluating news:', error);
        return NextResponse.json({ sentiment: 'NEUTRAL', news: null }, { status: 500 });
    }
}
