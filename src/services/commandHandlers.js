const LmService = require('./lmService');
const PostgresService = require('./databaseService');
const logger = require('../utils/logUtil');
const RedisService = require('./redisService');


module.exports = {
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
                const chatSession = await RedisService.getData(`${chatId}`)
                if (chatSession) {
                    const userMessage = req.body.message.text;
                    const conversation = await RedisService.getData(`conversation_${chatId}`);
                    let replyMsg = ''
                    if (conversation?.summary) {
                        replyMsg = await LmService.getResponse(`
                        Continue the conversation with the user, using the following summary to guide your response:
                        <summary>
                        ${conversation.summary}
                        </summary>
                        <user_message>
                        ${userMessage}
                        </user_message>
                        `)
                    } else replyMsg = await LmService.getResponse(userMessage)

                    SELF.sendMessage(replyMsg, chatId);
                    const summary = await LmService.getResponse(`
                        Summarize the given conversation into a concise summary (<200 characters) that captures its main intent:
                        ${userMessage}
                    `, false);
                    conversation.messages.push({
                        role: 'user',
                        content: userMessage
                    });
                    conversation.messages.push({
                        role: 'assistant',
                        content: replyMsg
                    });
                    conversation.summary = summary.trim();
                    await RedisService.storeData(`conversation_${chatId}`, chatSession);
                    return res.status(200).json({ status: 'ok' });
                }
                await Promise.all([
                    SELF.sendMessage(`Hello, how can I help you today?`, chatId),
                    RedisService.storeData(`${chatId}`, {
                        command: '/startconversation',
                    }),
                    RedisService.storeData(`conversation_${chatId}`, {
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