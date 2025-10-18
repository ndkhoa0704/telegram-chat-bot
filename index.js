require('dotenv').config();
const express = require('express')
const TelegramService = require('./services/telegramService');
const PostgresService = require('./services/databaseService');
const LmService = require('./services/lmService');
const ScheduleService = require('./services/scheduleService');

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Webhook endpoint
app.post('/api/webhook', TelegramService.sendReply);

app.listen(process.env.WEB_PORT, () => {
    LmService.init();
    TelegramService.setupWebhook();
    PostgresService.connect();
    ScheduleService.startJobs();
    console.log(`Server is running on port ${process.env.WEB_PORT}`);
})

async function gracefulShutdown() {
    const data = await TelegramService.deleteWebhook();
    console.log(data);
    ScheduleService.stopJobs();
    process.exit(0);
}


process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);