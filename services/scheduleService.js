const CronJob = require('cron').CronJob;
const PostgresService = require('./databaseService');
const LmService = require('./lmService');
const TelegramService = require('./telegramService');
const logger = require('../utils/logUtil');

function ScheduleService() {
    const SELF = {
        tasks: {},
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
        },
        stopJobs: () => {
            Object.values(SELF.tasks).forEach(job => {
                if (job && typeof job.stop === 'function') {
                    job.stop();
                }
            });
        }
    }
}

module.exports = ScheduleService();