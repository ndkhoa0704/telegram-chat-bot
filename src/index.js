const express = require('express')
const TelegramService = require('./services/telegramService');
const DatabaseService = require('./services/databaseService');
const LmService = require('./services/lmService');
const ScheduleService = require('./services/scheduleService');
const logger = require('./utils/logUtil');
const RedisService = require('./services/redisService');

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Webhook endpoint
app.post('/api/webhook', TelegramService.sendReply);

app.listen(process.env.WEB_PORT, async () => {
    LmService.init();
    RedisService.connect();
    TelegramService.setupWebhook();
    TelegramService.setupCommands();
    DatabaseService.connect();
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