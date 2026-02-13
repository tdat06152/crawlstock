import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');

export const geminiModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
});

export async function analyzeStockStrategy(data: {
    symbol: string,
    period: string,
    prices: any[],
    indicators: any,
    news: string[],
    marketContext?: string[]
}) {
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const prompt = `
Bạn là một chuyên gia phân tích chứng khoán cao cấp cho thị trường Việt Nam. 
Hãy thực hiện phân tích báo cáo chiến lược NGẮN GỌN cho mã: ${data.symbol}
Khoảng thời gian: ${data.period} (Dữ liệu 1 tuần gần nhất).

**Dữ liệu kỹ thuật:**
- Giá: ${JSON.stringify(data.prices.slice(-3))} (3 phiên gần nhất)
- Chỉ số (RSI, EMA200/MACD, Bollinger): ${JSON.stringify(data.indicators, null, 2)}

**Tin tức nổi bật:**
${data.news.length > 0 ? data.news.slice(0, 3).join('\n') : 'Không có.'}

**Yêu cầu phân tích TIÊU ĐIỂM (Tối đa 250 từ):**
1. Phân tích chi tiết 3 mẫu hình kỹ thuật (RSI, EMA200/MACD, Bollinger Bands) để xác định xu hướng.
2. Quét và đánh giá tác động của các tin tức gần đây đối với mã này.
3. Đưa ra chiến lược hành động cụ thể (Mua/Bán/Đợi) kèm vùng Target và Stoploss.

Hãy trả lời bằng tiếng Việt, trình bày súc tích, chuyên nghiệp bằng markdown.
`.trim();

    try {
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini Analysis Error:', error);
        throw error;
    }
}

export async function analyzeStockStrategyConcise(data: {
    symbol: string,
    close: number,
    indicators: any,
    news: string[],
    marketContext?: string[]
}) {
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const prompt = `
Phân tích nhanh mã ${data.symbol} (Giá hiện tại: ${data.close})
Dữ liệu kỹ thuật: ${JSON.stringify(data.indicators)}
Tin tức riêng: ${data.news.length > 0 ? data.news.slice(0, 2).join(', ') : 'Không có'}
Bối cảnh thị trường: ${data.marketContext && data.marketContext.length > 0 ? data.marketContext.slice(0, 2).join(', ') : 'Ổn định'}

Yêu cầu: Đưa ra nhận định cực kỳ ngắn gọn (tối đa 3-4 câu) về:
1. Tín hiệu chủ đạo (RSI/EMA/BB).
2. Hành động khuyến nghị (Mua/Bán/Đợi).
3. Vùng Target/Stoploss dự kiến.
Trả lời bằng tiếng Việt, súc tích, chuyên nghiệp.
`.trim();

    try {
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini Concise Analysis Error:', error);
        return 'Không thể thực hiện phân tích AI lúc này.';
    }
}
