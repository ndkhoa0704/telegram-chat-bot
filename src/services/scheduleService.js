const CronJob = require('cron').CronJob;
const DatabaseService = require('./databaseService');
const LmService = require('./lmService');
const TelegramService = require('./telegramService');
const logger = require('../utils/logUtil');
const RedisService = require('./redisService');


function ScheduleService() {
    const SELF = {
        tasks: {},
        coreJobs: {
            syncNewJobs: null,
            persistConversation: null,
            clearSessions: null,
        },
        syncNewJobs: async () => {
            logger.info(`Syncing new jobs`);
            const jobIds = Object.keys(SELF.tasks)
                .map((jobId) => Number(jobId))
                .filter((jobId) => Number.isFinite(jobId));
            let newJobs = [];
            if (jobIds.length === 0) {
                logger.info(`No existing jobs, syncing all tasks`);
                newJobs = await DatabaseService.executeQuery(`
                    select id, cron, prompt, description, chat_id
                    from tasks
                `);
            } else {
                const placeholders = jobIds.map(() => '?').join(', ');
                newJobs = await DatabaseService.executeQuery(`
                    select id, cron, prompt, description, chat_id
                    from tasks
                    where id NOT IN (${placeholders})
                `, jobIds);
            }
            logger.info(`Found ${newJobs.length} new jobs to sync`);
            newJobs.forEach(task => {
                if (SELF.tasks[task.id]) {
                    return;
                }
                logger.info(`Starting task ${task.id}`);
                SELF.tasks[task.id] = new CronJob(task.cron, async () => {
                    logger.info(`Running task ${task.id}`);
                    const response = await LmService.getResponse(task.prompt);
                    await TelegramService.sendMessage(response, task.chat_id);
                }, null, true, 'Asia/Bangkok');
            });
        },
        clearSessions: async () => {
            logger.info(`Clearing sessions`);
            const sessionKeys = await RedisService.getKeysByPrefix('session_');
            const currentTimestamp = Math.floor(Date.now() / 1000);
            for (const key of sessionKeys) {
                const session = await RedisService.getData(key);
                if (!session || !session.createdAt) {
                    continue;
                }
                if (currentTimestamp - session.createdAt < 300) { // 5 minutes
                    continue; // Skip sessions that are less than 5 minutes old
                }
                logger.info(`Clearing session ${key}`);
                await RedisService.deleteData(key);
            }
        },
        persistConversation: async () => {
            logger.info(`Persisting conversations`);
            const conversationKeys = await RedisService.getKeysByPrefix('conversation_');

            const currentTimestamp = Math.floor(Date.now() / 1000);
            for (const key of conversationKeys) {
                try {
                    const conversation = await RedisService.getData(key);
                    if (!conversation || !conversation.createdAt) {
                        continue;
                    }
                    if (currentTimestamp - conversation.createdAt < 300) { // 5 minutes
                        continue;
                    }
                    const keyParts = key.split('_');
                    const chatId = keyParts[keyParts.length - 1];
                    await DatabaseService.executeQuery(`
                        insert into conversations (chat_id, messages, summary, created_at)
                        values (?, ?, ?, ?)
                    `, [chatId, JSON.stringify(conversation.messages || []), conversation.summary || '',
                        new Date(conversation.createdAt * 1000)]);
                    await RedisService.deleteData(key);
                    logger.info(`Persisted conversation ${key}`);
                } catch (error) {
                    logger.error(`Failed to persist conversation ${key}: ${error.message || error}`);
                }
            }
        }
    }
    return {
        startJobs: async () => {
            const taskData = await DatabaseService.executeQuery(`
                select id, cron, prompt, description, chat_id
                from tasks
            `)
            taskData.forEach(task => {
                logger.info(`Starting task ${task.id}`);
                SELF.tasks[task.id] = new CronJob(task.cron, async () => {
                    logger.info(`Running task ${task.id}`);
                    const response = await LmService.getResponse(task.prompt);
                    await TelegramService.sendMessage(response, task.chat_id);
                    logger.info(`Task ${task.id} completed`);
                }, null, true, 'Asia/Bangkok');
            });
            logger.info(`Started ${taskData.length} jobs`);
            logger.info(`Starting syncNewJobs job`);
            SELF.coreJobs.syncNewJobs = new CronJob('*/5 * * * *', async () => {
                await SELF.syncNewJobs();
            }, null, true, 'Asia/Bangkok');
            logger.info(`Starting persistConversation job`);
            SELF.coreJobs.persistConversation = new CronJob('*/10 * * * *', async () => {
                await SELF.persistConversation();
            }, null, true, 'Asia/Bangkok');
            logger.info(`Starting clearSessions job`);
            SELF.coreJobs.clearSessions = new CronJob('*/5 * * * *', async () => {
                await SELF.clearSessions();
            }, null, true, 'Asia/Bangkok');
        },
        stopJobs: (idList = []) => {
            Object.entries(SELF.tasks).forEach(([taskId, job]) => {
                const shouldStop = idList.length === 0
                    || idList.includes(taskId)
                    || idList.includes(Number(taskId));
                if (shouldStop && job && typeof job.stop === 'function') {
                    job.stop();
                }
            });
            if (SELF.coreJobs.syncNewJobs && typeof SELF.coreJobs.syncNewJobs.stop === 'function') {
                SELF.coreJobs.syncNewJobs.stop();
            }
            if (SELF.persistConversationJob && typeof SELF.persistConversationJob.stop === 'function') {
                SELF.coreJobs.persistConversation.stop();
            }
            if (SELF.coreJobs.clearSessions && typeof SELF.coreJobs.clearSessions.stop === 'function') {
                SELF.coreJobs.clearSessions.stop();
            }
        },
        syncNewJobs: SELF.syncNewJobs
    }
}

module.exports = ScheduleService();