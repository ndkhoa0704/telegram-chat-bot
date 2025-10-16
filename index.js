require('dotenv').config();
const express = require('express')
const LmService = require('./services/lmService');
const TelegramService = require('./services/telegramService');

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());






// Webhook endpoint
app.post('/api/webhook', telegramService.sendReply);

app.listen(process.env.WEB_PORT, () => {
    telegramService.setupWebhook();
    console.log(`Server is running on port ${process.env.WEB_PORT}`);
})

async function gracefulShutdown() {
    const data = await telegramService.deleteWebhook();
    console.log(data);
    process.exit(0);
}


process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);