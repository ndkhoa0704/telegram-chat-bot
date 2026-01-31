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

// Store server instance for graceful shutdown
let server;

server = app.listen(process.env.WEB_PORT, async () => {
    LmService.init();
    RedisService.connect();
    TelegramService.setupWebhook();
    TelegramService.setupCommands();
    DatabaseService.connect();
    await ScheduleService.startJobs();
    logger.info(`Server is running on port ${process.env.WEB_PORT}`);
})

async function gracefulShutdown(signal) {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    // Set overall timeout for graceful shutdown (10 seconds)
    const shutdownTimeout = setTimeout(() => {
        logger.error('Graceful shutdown timeout, forcing exit');
        process.exit(1);
    }, 10000);

    try {
        // Close express server first (stop accepting new connections)
        if (server) {
            await new Promise((resolve) => {
                server.close(() => {
                    logger.info('Express server closed');
                    resolve();
                });
            });
        }

        // Delete webhook with timeout
        await Promise.race([
            TelegramService.deleteWebhook(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('deleteWebhook timeout')), 5000)
            )
        ]).catch(err => logger.error(`Error deleting webhook: ${err.message}`));

        await ScheduleService.stopJobs();
        await DatabaseService.disconnect();
        await RedisService.disconnect();

        logger.info('Graceful shutdown completed');
        clearTimeout(shutdownTimeout);
        process.exit(0);
    } catch (error) {
        logger.error(`Error during shutdown: ${error.stack}`);
        clearTimeout(shutdownTimeout);
        process.exit(1);
    }
}


process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));