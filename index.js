require('dotenv').config();
const express = require('express')
const TelegramService = require('./src/services/telegramService');
const PostgresService = require('./src/services/databaseService');
const LmService = require('./src/services/lmService');
const ScheduleService = require('./src/services/scheduleService');
const logger = require('./src/utils/logUtil');
const RedisService = require('./src/services/redisService');

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Webhook endpoint
app.post('/api/webhook', TelegramService.sendReply);

app.listen(process.env.WEB_PORT, async () => {
    LmService.init();
    RedisService.connect();
    TelegramService.setupWebhook();
    PostgresService.connect();
    await ScheduleService.startJobs();
    logger.info(`Server is running on port ${process.env.WEB_PORT}`);
})

async function gracefulShutdown() {
    await TelegramService.deleteWebhook();
    ScheduleService.stopJobs();
    process.exit(0);
}


process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);