
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

        const chatId = message.chat.id.toString();
        const text = message.text.toLowerCase().trim();
        const allowedChatId = process.env.TELEGRAM_CHAT_ID;

        // Security check
        if (allowedChatId && chatId !== allowedChatId) {
            console.warn(`[Telegram Webhook] Access denied for chatId: ${chatId}`);
            return NextResponse.json({ ok: true });
        }

        // Handle /ma command
        if (text === '/ma' || text === '/list' || text === '/check') {
            const supabase = createServiceClient();

            // 1. Fetch enabled watchlists
            const { data: watchlists, error: wError } = await supabase
                .from('watchlists')
                .select('*')
                .eq('enabled', true);

            if (wError || !watchlists || watchlists.length === 0) {
                await sendTelegramMessage('⚠️ Bạn chưa theo dõi mã nào hoặc có database đang lỗi.');
                return NextResponse.json({ ok: true });
            }

            // 2. Fetch latest prices separately
            const { data: prices } = await supabase
                .from('latest_prices')
                .select('*');

            const priceMap = new Map((prices || []).map(p => [p.symbol, p.price]));

            // 3. Compose response
            let responseMsg = '📊 <b>DANH MỤC THEO DÕI NĂNG ĐỘNG</b>\n\n';

            watchlists.forEach((item: any) => {
                const currentPrice = priceMap.get(item.symbol) || 0;
                const inZone = isInZone(currentPrice, item.buy_min, item.buy_max);
                const status = inZone ? '🔥 <b>IN ZONE</b>' : '⏳ Waiting';

                responseMsg += `🔹 <b>${item.symbol}</b>\n`;
                responseMsg += `   💰 Giá: <b>${currentPrice}</b>\n`;
                responseMsg += `   🎯 Zone: ${item.buy_min} - ${item.buy_max}\n`;
                responseMsg += `   📍 Status: ${status}\n\n`;
            });

            responseMsg += `<i>Cập nhật: ${new Date().toLocaleString('vi-VN')}</i>`;

            await sendTelegramMessage(responseMsg);
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Telegram Webhook] Error:', error);
        return NextResponse.json({ ok: true }); // Luôn trả về 200 để Telegram không gửi lại
    }
}
