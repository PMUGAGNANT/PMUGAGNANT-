'use strict';

const TELEGRAM_ENDPOINT = 'https://api.telegram.org';

async function sendMessage(text) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        return { sent: false, skipped: true };
    }

    const response = await fetch(`${TELEGRAM_ENDPOINT}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        })
    });

    if (!response.ok) {
        throw new Error(`Telegram send failed: ${response.status} ${await response.text()}`);
    }

    return { sent: true };
}

const telegramService = {
    sendMessage
};

module.exports = {
    telegramService
};
