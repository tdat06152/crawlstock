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
 * Scans Vietnamese article titles for positive/negative signal words.
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
 * Returns truncated content (~1500 chars max) for AI analysis.
 */
async function fetchArticleContent(url: string): Promise<string> {
    try {
        if (!url.startsWith('http')) return '';
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(7000),
        });
        if (!res.ok) return '';
        const html = await res.text();

        // Extract article body — CafeF specific selectors first, then generic fallbacks
        let text = '';
        const contentMatch =
            /<div[^>]+class="[^"]*detail-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html) ||
            /<div[^>]+class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html) ||
            /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html);

        text = contentMatch ? contentMatch[1] : html;

        // Strip scripts, styles, and all HTML tags
        text = text
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\s{2,}/g, ' ')
            .trim();

        // Keep to ~1500 chars to stay token-efficient
        return text.slice(0, 1500);
    } catch {
        return '';
    }
}

/**
 * Call Gemini with automatic retry ONLY on per-minute rate limits.
 * Daily quota exceeded → fails immediately (no point retrying).
 */
async function callGeminiWithRetry(prompt: string, maxRetries = 1): Promise<string> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await geminiModel.generateContent(prompt);
            return await result.response.text();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            const is429 = msg.includes('429');
            // Daily quota exceeded → quotaId contains 'PerDayPerProject', retrying won't help
            const isDailyQuota = msg.includes('PerDayPerProject');
            if (is429 && isDailyQuota) {
                throw err; // fail immediately → use keyword fallback
            }
            if (is429 && attempt < maxRetries) {
                // Per-minute limit: extract retry delay and wait
                const delayMatch = /Please retry in (\d+)/.exec(msg);
                const delaySec = delayMatch ? parseInt(delayMatch[1]) + 1 : 5;
                console.warn(`[Gemini 429/min] Retrying in ${delaySec}s (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delaySec * 1000));
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

    // ── 1. Check cache first ─────────────────────────────────────────────────
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

        // ── 2. Internal analysis posts → use saved DB sentiment ──────────────
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

        // ── 3. External news → fetch article content and call Gemini AI ──────
        const externalNews = news.filter(n => n.link.startsWith('http')).slice(0, 2);

        // Fetch article bodies in parallel
        const articleContents = await Promise.all(
            externalNews.map(async (n) => {
                const content = await fetchArticleContent(n.link);
                return {
                    title: n.title,
                    link: n.link,
                    content: content || '(Không thể đọc nội dung)',
                };
            })
        );

        const articlesText = articleContents.map((a, i) =>
            `--- Bài ${i + 1}: ${a.title} ---\n${a.content}`
        ).join('\n\n');

        const otherTitles = news
            .filter(n => !externalNews.find(e => e.link === n.link))
            .slice(0, 2)
            .map(n => `• ${n.title}`)
            .join('\n');

        let sentiment = 'NEUTRAL';
        try {
            const prompt = `Bạn là chuyên gia chứng khoán Việt Nam. Đọc nội dung bài báo sau và đánh giá tác động đến mã ${symbol}.

QUY TẮC:
- GOOD: Lợi nhuận tăng, tin tốt, phục hồi, hợp đồng lớn, kết quả kinh doanh khả quan.
- BAD: Lỗ, doanh thu giảm, rủi ro pháp lý, lãnh đạo bị bắt, nợ xấu, tin tiêu cực.
- NEUTRAL: Thủ tục hành chính thuần túy (đăng ký cuối cùng, họp ĐHCĐ bình thường).

LƯU Ý: "Bốc đầu" / "hồi phục mạnh" sau tin xấu thường là GOOD (thị trường đã digest tin xấu).

NỘI DUNG:
${articlesText}
${otherTitles ? `\nTIN KHÁC: ${otherTitles}` : ''}

Chỉ trả về 1 từ: GOOD, BAD, hoặc NEUTRAL.`;

            const textRaw = await callGeminiWithRetry(prompt);
            const text = textRaw.trim().toUpperCase();

            if (text.includes('GOOD')) sentiment = 'GOOD';
            else if (text.includes('BAD')) sentiment = 'BAD';
            else sentiment = 'NEUTRAL';

            console.log(`[News Sentiment] ${symbol}: ${sentiment} | articles: ${articleContents.length} | chars: ${articleContents.map(a => a.content.length).join('+')}`);
        } catch (aiError) {
            console.error(`[News Sentiment] AI error for ${symbol}:`, aiError);
            // Fallback: keyword-based sentiment from article titles (no AI needed)
            sentiment = keywordSentiment(news.map(n => n.title).join(' '));
            console.log(`[News Sentiment] ${symbol}: fallback keyword sentiment = ${sentiment}`);
        }

        setCache(symbol, sentiment, latestNewsItem);
        return NextResponse.json({ sentiment, news: latestNewsItem });

    } catch (error) {
        console.error('Error evaluating news:', error);
        return NextResponse.json({ sentiment: 'NEUTRAL', news: null }, { status: 500 });
    }
}
