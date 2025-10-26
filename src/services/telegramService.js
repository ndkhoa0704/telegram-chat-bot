const LmService = require('./lmService');
const PostgresService = require('./databaseService');
const logger = require('../utils/logUtil');
const RedisService = require('./redisService');

function TelegramService() {
    const SELF = {
        BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        API_URL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`,
        WEBHOOK_URL: `https://${process.env.TELEGRAM_WEBHOOK_URL}/api/webhook`,
        SEND_MSG_URL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        sendMessage: async (msg, chatId) => {
            const postData = {
                chat_id: chatId,
                text: msg,
                parse_mode: 'markdown'
            };

            const response = await fetch(SELF.SEND_MSG_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(postData)
            });
            if (!response.ok) {
                logger.error(`Error in sendMessage: ${response}`);
            }
        },
        commandHandlers: {
            '/tasks': {
                description: 'Hiển thị danh sách tất cả các task đã tạo',
                execute: async (req, res) => {
                    try {
                        const chatId = req.body.message.chat.id;
                        const tasks = await PostgresService.executeQuery(`
                            select id,cron, prompt, description
                            from tasks
                        `)
                        const msg = tasks?.length
                            ? tasks.map(task =>
                                `${task.id}|\`${task.cron}\`|${task.description}`).join('\n')
                            : 'No tasks found';
                        const response = await SELF.sendMessage(msg, chatId);
                        return res.status(200).json({ status: 'ok', response: response });
                    } catch (error) {
                        logger.error(`Error in /tasks: ${error}`);
                        return res.status(200).json({ status: 'ok' });
                    }
                }
            },
            '/createtask': {
                description: 'Tạo một task mới với cron schedule và prompt',
                execute: async (req, res, chatSession) => {
                    try {
                        const chatId = req.body.message.chat.id;
                        if (chatSession) {
                            if (!chatSession.data?.cron) {
                                const cron = req.body.message.text;
                                const cronRegex = /^((((\d+,)+\d+|(\d+(\/|-|#)\d+)|\d+L?|\*(\/\d+)?|L(-\d+)?|\?|[A-Z]{3}(-[A-Z]{3})?) ?){5,7})|(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every (\d+(ns|us|µs|ms|s|m|h))+)$/;
                                if (!cronRegex.test(cron)) {
                                    await SELF.sendMessage(`Invalid cron format. Please provide a valid cron string`, chatId);
                                    return res.status(200).json({ status: 'ok' });
                                }
                                chatSession.data.cron = cron;
                                await RedisService.storeData(chatId, chatSession);
                                const response = await SELF.sendMessage(`Give me your prompt`, chatId);
                                return res.status(200).json({ status: 'ok', response: response });
                            }
                            if (chatSession.data?.cron) {
                                const prompt = req.body.message.text.replace('/createtask ', '').trim();
                                logger.info(`Prompt: ${prompt}`);
                                const description = await LmService.getResponse(`
                                    Summarize the given AI prompt into a concise description (<200 characters) that captures its main intent:
                                    ${prompt}
                                `, false);
                                const cron = chatSession.data.cron;
                                await RedisService.storeData(chatId, chatSession, {
                                    EX: 300
                                });
                                await PostgresService.executeQuery(`
                                insert into tasks (cron, prompt, description, chat_id)
                                values ($1, $2, $3, $4)
                                `, [cron, prompt, description.trim(), chatId]);
                                await RedisService.deleteData(chatId);
                                const response = await SELF.sendMessage(`Task created successfully`, chatId);
                                return res.status(200).json({ status: 'ok', response: response });
                            }
                        }
                        const newChatSession = {
                            command: '/createtask',
                            data: {
                                cron: '',
                            },
                        };
                        await RedisService.storeData(chatId, newChatSession, { EX: 120 })
                        const response = await SELF.sendMessage(`Give me your cron`, chatId);
                        return res.status(200).json({ status: 'ok', response: response });
                    } catch (error) {
                        logger.error(`Error in /createtask: ${error.stack}`);
                        return res.status(200).json({ status: 'ok' });
                    }
                }
            },
            '/ask': {
                description: 'Đặt câu hỏi cho AI và nhận được phản hồi',
                execute: async (req, res) => {
                    try {
                        const chatId = req.body.message.chat.id;
                        const msgParts = req.body.message.text.split(' ');
                        const prompt = msgParts.slice(1).join(' ').trim();
                        if (!prompt) return res.status(200).json({ status: 'ok', response: 'Please provide a prompt' });
                        const replyMsg = await LmService.getResponse(prompt);
                        const response = await SELF.sendMessage(replyMsg, chatId);
                        return res.status(200).json({ status: 'ok', response: response });
                    } catch (error) {
                        logger.error(`Error in /ask: ${error.stack}`);
                        return res.status(200).json({ status: 'ok' });
                    }
                }
            },
            '/cancel': {
                description: 'Hủy thao tác hiện tại',
                execute: async (req, res) => {
                    const chatId = req.body.message.chat.id;
                    await RedisService.deleteData(chatId);
                    const response = await SELF.sendMessage(`Operation cancelled`, chatId);
                    return res.status(200).json({ status: 'ok', response: response });
                }
            },
            '/deletetask': {
                description: 'Xóa một task theo ID',
                execute: async (req, res) => {
                    try {
                        const chatId = req.body.message.chat.id;
                        const taskId = req.body.message.text.split(' ')[1];
                        await PostgresService.executeQuery(`
                            delete from tasks where id = $1 and chat_id = $2
                        `, [taskId, chatId]);
                        await SELF.sendMessage(`Task deleted successfully`, chatId);
                        return res.status(200).json({ status: 'ok', response: 'Task deleted successfully' });
                    } catch (error) {
                        logger.error(`Error in /deletetask: ${error.stack}`);
                        return res.status(200).json({ status: 'ok' });
                    }
                }
            },
            '/startconversation': {
                description: "Tạo cuộc hội thoại",
                execute: async (req, res) => {
                    try {
                        const chatId = req.body.message.chat.id;
                        const chatSession = await RedisService.getData(chatId)
                        if (chatSession) {
                            const userMessage = req.body.message.text;
                            const replyMsg = await LmService.getResponse(userMessage)
                            SELF.sendMessage(replyMsg, chatId);
                            const summary = await LmService.getResponse(`
                                Summarize the given conversation into a concise summary (<200 characters) that captures its main intent:
                                ${userMessage}
                            `, false);
                            chatSession.messages.push({
                                role: 'user',
                                content: userMessage
                            });
                            chatSession.messages.push({
                                role: 'assistant',
                                content: replyMsg
                            });
                            chatSession.summary = summary.trim();
                            await RedisService.storeData(chatId, chatSession);
                            return res.status(200).json({ status: 'ok' });
                        }
                        await Promise.all([
                            SELF.sendMessage(`Hello, how can I help you today?`, chatId),
                            RedisService.storeData(chatId, {
                                command: '/startconversation',
                                messages: [],
                                summary: ''
                            })
                        ]);
                        return res.status(200).json({ status: 'ok' });
                    } catch (error) {
                        logger.error(`Error in /startconversation: ${error.stack}`);
                        return res.status(200).json({ status: 'ok' });
                    }
                }
            }
        }
    }

    return {
        setupWebhook: async () => {
            const response = await fetch(`${SELF.API_URL}/setWebhook?url=${SELF.WEBHOOK_URL}`);
            const data = await response.json();
            logger.info(`Setup webhook response: ${JSON.stringify(data, null, 2)}`);
        },
        deleteWebhook: async () => {
            const response = await fetch(`${SELF.API_URL}/deleteWebhook`);
            const data = await response.json();
            logger.info(`Delete webhook response: ${JSON.stringify(data, null, 2)}`);
            return data;
        },
        sendReply: async (req, res) => {
            try {
                // Extract message data from webhook payload
                const update = req.body;
                logger.info(`Send reply: ${JSON.stringify(update, null, 2)}`);

                const chatSession = await RedisService.getData(update.message.chat.id);
                if (update.message.text.startsWith('/')) {
                    if (chatSession) {
                        await RedisService.deleteData(update.message.chat.id);
                        return res.status(200).json({ status: 'ok' });
                    }
                    const command = update.message.text.split(' ')[0];
                    const commandHandler = SELF.commandHandlers[command];
                    if (commandHandler) return commandHandler.execute(req, res);
                    return res.status(200).json({ status: 'Invalid command' });
                }

                logger.info(`Chat session: ${JSON.stringify(chatSession, null, 2)}`);
                if (chatSession?.command) {
                    const commandHandler = SELF.commandHandlers[chatSession.command];
                    if (commandHandler) return commandHandler.execute(req, res, chatSession);
                    await RedisService.deleteData(update.message.chat.id);
                    return res.status(200).json({ status: 'Invalid session' });
                }


                return res.status(200).json({ status: 'ok' });
            } catch (error) {
                logger.error(`Error processing webhook: ${error}`);
                return res.status(200).json({ status: 'ok' });
            }
        },
        sendMessage: async (msg, chatId) => {
            return SELF.sendMessage(msg, chatId);
        },
        setupCommands: async () => {
            const commands = Object.keys(SELF.commandHandlers).map(command => ({
                command: command,
                description: SELF.commandHandlers[command].description
            }));
            const response = await fetch(`${SELF.API_URL}/setMyCommands`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ commands })
            });
            const data = await response.json();
            logger.info(`Setup commands response: ${JSON.stringify(data, null, 2)}`);
            return data;
        }
    }
}

module.exports = TelegramService();