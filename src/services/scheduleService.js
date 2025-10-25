const CronJob = require('cron').CronJob;
const PostgresService = require('./databaseService');
const LmService = require('./lmService');
const TelegramService = require('./telegramService');
const logger = require('../utils/logUtil');

function ScheduleService() {
    const SELF = {
        tasks: {},
        syncNewJob: null,
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
                logger.info(`Starting new task ${task.id} with cron ${task.cron} and description ${task.description} and chat_id ${task.chat_id}`);
                const job = new CronJob(task.cron, async () => {
                    logger.info(`Running new task ${task.id} with cron ${task.cron} and description ${task.description} and chat_id ${task.chat_id}`);
                    const response = await LmService.getResponse(task.prompt);
                    await TelegramService.sendMessage(response, task.chat_id);
                });
                SELF.tasks[task.id] = job;
                SELF.tasks[task.id].start();
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
                logger.info(`Starting task ${task.id} with cron ${task.cron} and description ${task.description} and chat_id ${task.chat_id}`);
                const job = new CronJob(task.cron, async () => {
                    logger.info(`Running task ${task.id} with cron ${task.cron} and description ${task.description} and chat_id ${task.chat_id}`);
                    const response = await LmService.getResponse(task.prompt);
                    await TelegramService.sendMessage(response, task.chat_id);
                });
                SELF.tasks[task.id] = job;
                SELF.tasks[task.id].start();
            });
            logger.info(`Started ${taskData.length} jobs`);
            logger.info(`Starting syncNewJobs job`);
            SELF.syncNewJob = new CronJob('*/5 * * * *', async () => {
                await SELF.syncNewJobs();
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
        }
    }
}

module.exports = ScheduleService();