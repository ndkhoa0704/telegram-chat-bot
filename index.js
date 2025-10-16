require('dotenv').config();
const express = require('express')
const TelegramService = require('./services/telegramService');
const PostgresService = require('./services/databaseService');

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Webhook endpoint
app.post('/api/webhook', TelegramService.sendReply);

app.listen(process.env.WEB_PORT, () => {
    TelegramService.setupWebhook();
    PostgresService.connect();
    console.log(`Server is running on port ${process.env.WEB_PORT}`);
})

async function gracefulShutdown() {
    const data = await TelegramService.deleteWebhook();
    console.log(data);
    process.exit(0);
}


process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);