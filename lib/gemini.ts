import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Two separate Gemini clients ────────────────────────────────────────────
// GEMINI_LOOKUP_KEY  → dành cho đánh giá sắc thái tin tức (/api/news/evaluate)
// GEMINI_ANALYSIS_KEY → dành cho phân tích kỹ thuật + quét thị trường
const lookupKey = process.env.GEMINI_LOOKUP_KEY || '';
const analysisKey = process.env.GEMINI_ANALYSIS_KEY || '';

const lookupGenAI = new GoogleGenerativeAI(lookupKey);
const analysisGenAI = new GoogleGenerativeAI(analysisKey);

// Các model instance
export const geminiModel = lookupGenAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
export const analysisGeminiModel = analysisGenAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// ─── 1. Phân tích chiến lược đầy đủ (dùng cho /api/analysis) ────────────────
// Ngắn gọn hơn: tối đa 200 từ, tập trung vào hành động
export async function analyzeStockStrategy(data: {
    symbol: string,
    period: string,
    prices: any[],
    indicators: any,
    news: string[],
    marketContext?: string[]
}) {
    if (!analysisKey) throw new Error('GEMINI_ANALYSIS_KEY is not configured');

    const prompt = `Bạn là chuyên gia chứng khoán Việt Nam. Phân tích ngắn gọn mã ${data.symbol} (${data.period}).

DỮ LIỆU KỸ THUẬT:
- Giá 3 phiên gần nhất: ${JSON.stringify(data.prices.slice(-3))}
- RSI: ${JSON.stringify(data.indicators.rsi)}
- EMA/MACD: ${JSON.stringify(data.indicators.ema_macd)}
- Bollinger: ${JSON.stringify(data.indicators.bollinger)}

TIN TỨC 14 NGÀY GẦN NHẤT:
${data.news.length > 0 ? data.news.slice(0, 5).join('\n') : 'Không có tin mới'}

YÊU CẦU (tối đa 150 từ, dùng markdown):
1. **Kỹ thuật**: Nhận định 3 mẫu hình (RSI/EMA-MACD/BB) → xu hướng chung
2. **Tin tức**: Tác động của tin tức gần đây đến mã này
3. **Khuyến nghị**: Mua/Bán/Đợi + Target + Stoploss cụ thể

Ngắn gọn, sắc sảo, chuyên nghiệp.`.trim();

    try {
        const result = await analysisGeminiModel.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini Analysis Error:', error);
        throw error;
    }
}

// ─── 2. Phân tích súc tích cho Market Scan (dùng cho lib/market-scanner.ts) ──
// Tối đa 4 câu, ưu tiên tin tức
export async function analyzeStockStrategyConcise(data: {
    symbol: string,
    close: number,
    indicators: any,
    news: string[],
    marketContext?: string[]
}) {
    if (!analysisKey) throw new Error('GEMINI_ANALYSIS_KEY is not configured');

    const prompt = `Chuyên gia chứng khoán VN. Phân tích ${data.symbol} (Giá: ${data.close}).

TIN TỨC: ${data.news.length > 0 ? data.news.slice(0, 3).join(' | ') : 'Không có tin mới.'}
BỐI CẢNH: ${data.marketContext && data.marketContext.length > 0 ? data.marketContext.slice(0, 2).join(' | ') : 'Ổn định.'}
KỸ THUẬT (3 mẫu hình đều đồng thuận): ${JSON.stringify(data.indicators)}

TRẢ LỜI (tối đa 4 câu tiếng Việt):
1. [TIN TỨC] Sự kiện đang tác động thế nào?
2. [HÀNH ĐỘNG] Khuyến nghị cụ thể (Mua/Bán/Đợi)?
3. [MỤC TIÊU] Target/Stoploss?
4. [RỦI RO] Rủi ro cần lưu ý?`.trim();

    try {
        console.log(`[AI Analysis] Processing ${data.symbol} with ${data.news.length} news items.`);
        const result = await analysisGeminiModel.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        if (data.news.length === 0) {
            text += '\n\n<i>(Lưu ý: Phân tích dựa trên bối cảnh chung, không có tin tức cụ thể)</i>';
        }
        return text;
    } catch (error) {
        console.error('Gemini Concise Analysis Error:', error);
        return 'Không thể thực hiện phân tích AI lúc này.';
    }
}
