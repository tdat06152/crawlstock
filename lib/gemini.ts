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
Bạn là một chuyên gia phân tích chứng khoán am hiểu sâu sắc thị trường Việt Nam.
Nhiệm vụ: Phân tích mã ${data.symbol} (Giá: ${data.close}) dựa trên TIN TỨC và BỐI CẢNH là ưu tiên số 1, KỸ THUẬT là xác nhận số 2.

DỮ LIỆU ĐẦU VÀO:
1. Tin tức doanh nghiệp: ${data.news.length > 0 ? data.news.join(' | ') : 'Không có tin mới quan trọng.'}
2. Bối cảnh thị trường chung: ${data.marketContext && data.marketContext.length > 0 ? data.marketContext.join(' | ') : 'Ổn định/Chưa có tin hot.'}
3. Dữ liệu kỹ thuật (3 mẫu hình): ${JSON.stringify(data.indicators)}

YÊU CẦU TRẢ LỜI (Cực kỳ ngắn gọn, max 4 câu):
1. [TIN TỨC]: Nhận định sự kiện/tin tức đang tác động trực tiếp thế nào đến mã này (Nếu không có tin, nêu bối cảnh ngành/thị trường).
2. [HÀNH ĐỘNG]: Khuyến nghị hành động (Mua/Bán/Đợi) dựa trên việc tin tức có ủng hộ tín hiệu kỹ thuật từ 3 mẫu hình hay không.
3. [MỤC TIÊU]: Vùng Target/Stoploss dự kiến.

Ngôn ngữ: Tiếng Việt, chuyên nghiệp, sắc sảo.
`.trim();

    try {
        // Debug: Log news count to ensure data is flowing
        console.log(`[AI Analysis] Processing ${data.symbol} with ${data.news.length} news items.`);

        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Thêm hậu tố kiểm chứng dữ liệu nếu news trống để user biết
        if (data.news.length === 0) {
            text += '\n\n<i>(Lưu ý: Không tìm thấy tin tức mới cụ thể cho mã này, phân tích dựa trên bối cảnh chung)</i>';
        }

        return text;
    } catch (error) {
        console.error('Gemini Concise Analysis Error:', error);
        return 'Không thể thực hiện phân tích AI lúc này.';
    }

}
