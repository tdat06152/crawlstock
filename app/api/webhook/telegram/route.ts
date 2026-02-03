
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { sendTelegramMessage } from '@/lib/telegram';
import { isInZone } from '@/lib/alert-logic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Telegram gửi update trong trường 'message'
        const message = body.message;
        if (!message || !message.text) {
            return NextResponse.json({ ok: true });
        }

        const chatId = message.chat.id;
        const text = message.text.toLowerCase().trim();

        // Kiểm tra lệnh /ma hoặc /list
        if (text === '/ma' || text === '/list' || text === '/check') {
            const supabase = createServiceClient();

            // 1. Lấy danh sách watchlist và join với giá mới nhất
            // Lưu ý: Chúng ta lấy dữ liệu từ bảng watchlists và so sánh với latest_prices
            const { data: watchlists, error } = await supabase
                .from('watchlists')
                .select(`
                    *,
                    latest_prices (price, ts)
                `)
                .eq('enabled', true);

            if (error || !watchlists || watchlists.length === 0) {
                await sendTelegramMessage('⚠️ Bạn chưa theo dõi mã nào hoặc có lỗi xảy ra.');
                return NextResponse.json({ ok: true });
            }

            // 2. Soạn tin nhắn trả lời
            let responseMsg = '📊 <b>DANH MỤC THEO DÕI NĂNG ĐỘNG</b>\n\n';

            watchlists.forEach((item: any) => {
                const currentPrice = item.latest_prices?.price || 0;
                const inZone = isInZone(currentPrice, item.buy_min, item.buy_max);
                const status = inZone ? '🔥 <b>IN ZONE</b>' : '⏳ Waiting';

                responseMsg += `🔹 <b>${item.symbol}</b>\n`;
                responseMsg += `   💰 Giá: ${currentPrice}\n`;
                responseMsg += `   🎯 Zone: ${item.buy_min} - ${item.buy_max}\n`;
                responseMsg += `   📍 Trạng thái: ${status}\n\n`;
            });

            responseMsg += `<i>Cập nhật lúc: ${new Date().toLocaleString('vi-VN')}</i>`;

            await sendTelegramMessage(responseMsg);
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Telegram Webhook] Error:', error);
        return NextResponse.json({ ok: true }); // Luôn trả về 200 để Telegram không gửi lại
    }
}
