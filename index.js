require('dotenv').config();
const express = require('express')

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());


function TelegramService() {
    const SELF = {
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        TELEGRAM_API_URL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`,
        TELEGRAM_WEBHOOK_URL: `https://${process.env.TELEGRAM_WEBHOOK_URL}/api/webhook`,
    }

    console.log(SELF);

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

                console.log(update);

                if (!update.message) {
                    return res.status(200).json({ status: 'ok' }); // Ignore non-message updates
                }

                const chatId = update.message.chat.id;
                const receivedMessage = update.message.text;

                console.log(`Received message from ${chatId}: ${receivedMessage}`);

                // Process the message here (you can add your bot logic)
                // For now, just echo back the message
                const replyText = `Echo: ${receivedMessage}`;

                const response = await fetch(`${SELF.TELEGRAM_API_URL}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(replyText)}`);
                const data = await response.json();

                if (data.ok) {
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

const telegramService = TelegramService();

// Webhook endpoint
app.post('/api/webhook', telegramService.sendReply);

app.listen(3000, () => {
    telegramService.setupWebhook();
    console.log('Server is running on port 3000');
})

async function gracefulShutdown() {
    const data = await telegramService.deleteWebhook();
    console.log(data);
    process.exit(0);
}


process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);