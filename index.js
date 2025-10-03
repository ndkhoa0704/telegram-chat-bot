require('dotenv').config();
const express = require('express')
const { OpenAI } = require('openai');
const prompts = require('./prompts');

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());


function LmService() {
    const SELF = {
        client: (() => {
            if (!process.env.USE_LOCAL_AI) {
                return new OpenAI({
                    baseURL: process.env.LOCAL_AI_URL,
                })
            }
            console.log('Is using remote AI');
            return new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            })
        })(),
        removeThinkBlock: (text) => {
            return text.split('</think>')[1]
        },
    }
    return {
        getResponse: async (message) => {
            const response = await SELF.client.chat.completions.create({
                model: process.env.LM_MODEL,
                messages: [
                    { role: "system", content: prompts.limitWords(1000) },
                    { role: "user", content: message }
                ],
                tool_choice: "auto",
                tools: []
            })
            return SELF.removeThinkBlock(response.choices[0].message.content)
        }
    }
}

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

const lmService = LmService();
const telegramService = TelegramService();


// Webhook endpoint
app.post('/api/webhook', telegramService.sendReply);

app.listen(process.env.PORT, () => {
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