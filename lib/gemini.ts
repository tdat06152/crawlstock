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
    news: string[]
}) {
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const prompt = `
Bạn là một chuyên gia phân tích chứng khoán cao cấp cho thị trường Việt Nam. 
Hãy thực hiện phân tích báo cáo chiến lược cho mã cổ phiếu: ${data.symbol}
Khoảng thời gian phân tích: ${data.period} (Dữ liệu 1 tuần gần nhất).

**Dữ liệu kỹ thuật:**
1. Diễn biến giá: ${JSON.stringify(data.prices)}
2. Các chỉ số kỹ thuật hiện tại (Dựa trên 3 mẫu hình: RSI, EMA200/MACD, Bollinger Bands):
${JSON.stringify(data.indicators, null, 2)}

**Thông tin tin tức/sự kiện liên quan trong tuần:**
${data.news.length > 0 ? data.news.join('\n') : 'Không có tin tức nổi bật.'}

**Yêu cầu phân tích:**
1. Đánh giá xu hướng hiện tại dựa trên 3 mẫu hình kỹ thuật trên.
2. Tổng hợp tác động của tin tức đối với tâm lý thị trường và kỳ vọng giá.
3. Đưa ra chiến lược cụ thể (Mua/Bán/Nắm giữ/Quan sát) kèm theo các vùng giá mục tiêu/cắt lỗ cụ thể.
4. Dự báo ngắn hạn cho tuần tới.

Hãy trả lời bằng tiếng Việt, trình bày chuyên nghiệp, sử dụng markdown để dễ đọc. 
Tập trung vào tính thực chiến và logic của 3 mẫu hình (RSI, EMA200/MACD, BB).
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
