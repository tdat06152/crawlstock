
export async function sendTelegramMessage(message: string, specificChatId?: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatIds = specificChatId
        ? [specificChatId]
        : (process.env.TELEGRAM_CHAT_ID?.split(',') || []);

    if (!token || chatIds.length === 0) {
        console.warn('[Telegram] Missing token or chatId. Skipping notification.');
        return;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    for (const id of chatIds) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: id.trim(),
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            if (!response.ok) {
                const err = await response.json();
                console.error(`[Telegram] Error sending message to ${id}:`, err);
            } else {
                console.log(`[Telegram] Notification sent successfully to ${id}`);
            }
        } catch (error) {
            console.error(`[Telegram] Fetch error for ${id}:`, error);
        }
    }
}
