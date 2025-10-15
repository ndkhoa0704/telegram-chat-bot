function TelegramService() {
    const SELF = {
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        TELEGRAM_API_URL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`,
        TELEGRAM_WEBHOOK_URL: `https://${process.env.TELEGRAM_WEBHOOK_URL}/api/webhook`,
    }

    return {
        setupWebhook: async () => {
            const response = await fetch(`${SELF.TELEGRAM_API_URL}/setWebhook?url=${SELF.TELEGRAM_WEBHOOK_URL}`);
            const data = await response.json();
            console.log(data);
        },
        deleteWebhook: async () => {
            const response = await fetch(`${SELF.TELEGRAM_API_URL}/deleteWebhook`);
            const data = await response.json();
            console.log('Delete webhook response:', data);
            return data;
        },
        sendReply: async (req, res) => {
            try {
                // Extract message data from webhook payload
                const update = req.body;

                console.log('Received message:', update);

                if (!update.message) {
                    return res.status(200).json({ status: 'ok' }); // Ignore non-message updates
                }

                const replyText = await lmService.getResponse(update.message.text);

                const postData = {
                    chat_id: update.message.chat.id,
                    text: replyText,
                    parse_mode: 'markdown'
                };

                const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(postData)
                });

                const data = await response.json();

                if (response.ok) {
                    console.log('Reply sent successfully');
                    res.status(200).json({ status: 'ok' });
                } else {
                    console.error('Failed to send reply:', data);
                    res.status(500).json({ error: 'Failed to send reply' });
                }
            } catch (error) {
                console.error('Error processing webhook:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        },
        sendMessage: async (chatId, message) => {
            const response = await fetch(`${SELF.TELEGRAM_API_URL}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(message)}`);
            const data = await response.json();
            console.log(data);
            return data;
        },
    }
}

module.exports = TelegramService();