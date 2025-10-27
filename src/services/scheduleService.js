const CronJob = require('cron').CronJob;
const PostgresService = require('./databaseService');
const LmService = require('./lmService');
const TelegramService = require('./telegramService');
const logger = require('../utils/logUtil');
const RedisService = require('./redisService');

function ScheduleService() {
    const SELF = {
        tasks: {},
        syncNewJob: null,
        persistConversationJob: null,
        syncNewJobs: async () => {
            logger.info(`Syncing new jobs`);
            const jobIds = Object.keys(SELF.tasks);
            if (jobIds.length === 0) {
                logger.info(`No jobs to sync`);
                return;
            }
            const newJobs = await PostgresService.executeQuery(`
                select id, cron, prompt, description, chat_id
                from tasks
                where id not in (${jobIds.join(',')})
            `)
            logger.info(`Found ${newJobs.length} new jobs to sync`);
            newJobs.forEach(task => {
                logger.info(`Starting task ${task.id}`);
                SELF.tasks[task.id] = new CronJob(task.cron, async () => {
                    logger.info(`Running task ${task.id}`);
                    const response = await LmService.getResponse(task.prompt);
                    await TelegramService.sendMessage(response, task.chat_id);
                }, null, true, 'Asia/Bangkok');
            });
        },
        persistConversation: async () => {
            const conversationKeys = await RedisService.getKeysByPrefix('conversation_');
            conversationKeys.forEach(async (key) => {
                const conversation = await RedisService.getData(key);
                await PostgresService.executeQuery(`
                    insert into conversations (chat_id, messages, summary)
                    values ($1, $2, $3)
                `, [key.split('_')[1], JSON.stringify(conversation.messages), conversation.summary]);
                await RedisService.deleteData(key);
            });
        }
    }
    return {
        startJobs: async () => {
            const taskData = await PostgresService.executeQuery(`
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
            SELF.syncNewJob = new CronJob('*/5 * * * *', async () => {
                await SELF.syncNewJobs();
            });
            logger.info(`Starting persistConversation job`);
            SELF.persistConversationJob = new CronJob('*/10 * * * *', async () => {
                await SELF.persistConversation();
            });
        },
        stopJobs: (idList = []) => {
            Object.values(SELF.tasks).forEach(job => {
                if (idList.includes(job.id)) {
                    if (job && typeof job.stop === 'function') {
                        job.stop();
                    }
                }
            });
            if (SELF.syncNewJob && typeof SELF.syncNewJob.stop === 'function') {
                SELF.syncNewJob.stop();
            }
            if (SELF.persistConversationJob && typeof SELF.persistConversationJob.stop === 'function') {
                SELF.persistConversationJob.stop();
            }
        }
    }
}

module.exports = ScheduleService();