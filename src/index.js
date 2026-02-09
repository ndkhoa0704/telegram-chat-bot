import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TelegramService from './services/telegram.service.js';
import DatabaseService from './services/database.service.js';
import LmService from './services/lm.service.js';
import ScheduleService from './services/schedule.service.js';
import logger from './utils/log.util.js';
import RedisService from './services/redis.service.js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

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