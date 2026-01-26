const express = require('express')
const TelegramService = require('./services/telegram.service');
const DatabaseService = require('./services/database.service');
const LmService = require('./services/lm.service');
const ScheduleService = require('./services/schedule.service');
const logger = require('./utils/log.util');
const RedisService = require('./services/redis.service');

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
    TelegramService.deleteWebhook();
    ScheduleService.stopJobs();
    DatabaseService.disconnect();
    RedisService.disconnect();
    logger.info('Server is shutting down');
    process.exit(1);
}


process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);