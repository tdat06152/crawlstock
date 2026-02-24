import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function main() {
    const symbol = 'PLX';
    const latestNewsText = "[BÀI PHÂN TÍCH NỘI BỘ]: [StockMonitor Analysis] Kỳ nguyên vươn mình của doanh nghiệp Nhà nước: Từ Nghị định 57 đến hiện thực hóa mục tiêu nâng cao năng lực cạnh tranh";
    
    const prompt = `Bạn là chuyên gia chứng khoán am hiểu sâu sắc thị trường Việt Nam.
    Hãy đánh giá tác động của các tin tức và bài phân tích sau đây đối với mã cổ phiếu ${symbol}.
    
    QUY TẮC PHÂN LOẠI:
    1. KHÁCH QUAN: Đánh giá dựa trên nội dung tiêu đề. Nếu tin mang lại triển vọng tăng trưởng, báo lãi, hoặc kế hoạch tích cực thì là GOOD. Nếu tin báo lỗ, giảm sút, rủi ro thì là BAD.
    2. KHÔNG PHÂN BIỆT NGUỒN TIN: Cả [BÀI PHÂN TÍCH NỘI BỘ] và [TIN TỨC CÔNG KHAI] đều phải được đánh giá dựa trên hướng tích cực/tiêu cực của chúng. Bài phân tích có thể cảnh báo rủi ro (BAD) hoặc triển vọng (GOOD).
    3. HẠN CHẾ TRUNG LẬP: Tránh chọn NEUTRAL tối đa. Chỉ chọn NEUTRAL khi tin hoàn toàn là thông tin hành chính không ảnh hưởng đến giá cổ phiếu.
    
    CHỈ TRẢ VỀ ĐÚNG 1 TỪ DUY NHẤT: GOOD, BAD, hoặc NEUTRAL.
    
    Dữ liệu đầu vào:
    ${latestNewsText}`;

    const result = await model.generateContent(prompt);
    console.log("Gemini Response:", result.response.text().trim());
}
main();
