import logger from '../utils/log.util.js';
import RedisService from './redis.service.js';
import DatabaseService from './database.service.js';
import LmService from './lm.service.js';
import ScheduleService from './schedule.service.js';
import prompts from '../prompts/index.js';

function TelegramService() {
    const SELF = {
        BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        API_URL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`,
        WEBHOOK_URL: `https://${process.env.TELEGRAM_WEBHOOK_HOSTNAME}/api/webhook`,
        SEND_MSG_URL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        sendMessage: async (msg, chatId, options = {}) => {
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
                const error = await response.json();
                logger.error(`Error in sendMessage: ${JSON.stringify(error, null, 2)}`);
            }
            // Return options for tracking (e.g., excludeFromContext flag)
            return { ...options };
        }
    }
    const COMMAND_HANDLERS = {
        '/tasks': {
            description: 'Hiển thị danh sách tất cả các task đã tạo',
            isConversationCommand: false,
            execute: async (req, res, chatSession) => {
                try {
                    const chatId = req.body.message.chat.id;

                    // Interactive flow: if session exists, user is providing input
                    if (chatSession?.command === '/tasks') {
                        // User responded, now show tasks
                        const tasks = await DatabaseService.executeQuery(`
                            select id, cron, prompt, description
                            from tasks
                            where chat_id = ?
                        `, [chatId]);
                        const msg = tasks?.length
                            ? tasks.map(task =>
                                `${task.id}|\`${task.cron}\`|${task.description}`).join('\n')
                            : 'Không có task nào.';
                        await SELF.sendMessage(msg, chatId);
                        await RedisService.deleteData(`session_${chatId}`);
                        return res.status(200).json({ status: 'ok' });
                    }

                    // First call: ask user what they want
                    await RedisService.storeData(`session_${chatId}`, {
                        command: '/tasks',
                        data: {}
                    });
                    await SELF.sendMessage('Bạn muốn xem danh sách task? Gửi bất kỳ tin nhắn nào để tiếp tục.', chatId);
                    return res.status(200).json({ status: 'ok' });
                } catch (error) {
                    logger.error(`Error in /tasks: ${error.stack}`);
                    return res.status(200).json({ status: 'ok' });
                }
            }
        },
        '/createtask': {
            description: 'Tạo một task mới với cron schedule và prompt',
            isConversationCommand: false,
            execute: async (req, res, chatSession) => {
                try {
                    const chatId = req.body.message.chat.id;
                    const messageText = req.body.message.text.trim();

                    // Check if it's a one-shot command (has content after /createtask)
                    if (messageText.length > '/createtask'.length) {
                        const userRequest = messageText.replace('/createtask', '').trim();
                        logger.info(`Processing natural language task request: ${userRequest}`);

                        await SELF.sendMessage("Processing your request...", chatId);

                        const rawResponse = await LmService.getResponse(`
                            ${prompts.task_parser}

                            User Input: "${userRequest}"
                        `, false);

                        let parsedTask;
                        try {
                            // Clean up json if wrapped in markdown code blocks
                            const jsonStr = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
                            parsedTask = JSON.parse(jsonStr);
                        } catch (_e) {
                            logger.error(`Failed to parse AI response: ${rawResponse}`);
                            await SELF.sendMessage("Sorry, I couldn't understand the schedule format.", chatId);
                            return res.status(200).json({ status: 'ok' });
                        }

                        if (!parsedTask.cron || !parsedTask.prompt) {
                            await SELF.sendMessage("Could not extract valid cron or prompt.", chatId);
                            return res.status(200).json({ status: 'ok' });
                        }

                        // Validate cron
                        const cronRegex = /^((((\d+,)+\d+|(\d+(\/|-|#)\d+)|\d+L?|\*(\/\d+)?|L(-\d+)?|\?|[A-Z]{3}(-[A-Z]{3})?) ?){5,7})|(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every (\d+(ns|us|µs|ms|s|m|h))+)$/;
                        if (!cronRegex.test(parsedTask.cron)) {
                            await SELF.sendMessage(`Invalid cron format generated: ${parsedTask.cron}`, chatId);
                            return res.status(200).json({ status: 'ok' });
                        }

                        await DatabaseService.executeQuery(`
                            insert into tasks (cron, prompt, description, chat_id)
                            values (?, ?, ?, ?)
                        `, [parsedTask.cron, parsedTask.prompt, parsedTask.prompt, chatId]);

                        // Trigger sync immediately
                        ScheduleService.syncNewJobs();

                        const response = await SELF.sendMessage(`Task created!\nCron: \`${parsedTask.cron}\`\nPrompt: ${parsedTask.prompt}`, chatId);
                        return res.status(200).json({ status: 'ok', response: response });
                    }

                    // Original interactive flow
                    if (chatSession) {
                        if (!chatSession.data?.cron) {
                            const cron = req.body.message.text;
                            const cronRegex = /^((((\d+,)+\d+|(\d+(\/|-|#)\d+)|\d+L?|\*(\/\d+)?|L(-\d+)?|\?|[A-Z]{3}(-[A-Z]{3})?) ?){5,7})|(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every (\d+(ns|us|µs|ms|s|m|h))+)$/;
                            if (!cronRegex.test(cron)) {
                                await SELF.sendMessage(`Invalid cron format. Please provide a valid cron string`, chatId);
                                return res.status(200).json({ status: 'ok' });
                            }
                            chatSession.data.cron = cron;
                            await RedisService.storeData(`session_${chatId}`, chatSession);
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
                            await RedisService.storeData(`session_${chatId}`, chatSession, {
                                EX: 300
                            });
                            await DatabaseService.executeQuery(`
                            insert into tasks (cron, prompt, description, chat_id)
                            values (?, ?, ?, ?)
                            `, [cron, prompt, description.trim(), chatId]);
                            await RedisService.deleteData(`session_${chatId}`);

                            // Trigger sync
                            ScheduleService.syncNewJobs();

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
                    await RedisService.storeData(`session_${chatId}`, newChatSession);
                    const response = await SELF.sendMessage(`Give me your cron`, chatId);
                    return res.status(200).json({ status: 'ok', response: response });
                } catch (error) {
                    logger.error(`Error in /createtask: ${error.stack}`);
                    return res.status(200).json({ status: 'ok' });
                }
            }
        },
        '/order': {
            description: 'Tạo task tự động từ yêu cầu của bạn',
            isConversationCommand: false,
            execute: async (req, res, chatSession) => {
                try {
                    const chatId = req.body.message.chat.id;
                    const messageText = req.body.message.text.trim();

                    // Helper function to process order request
                    const processOrderRequest = async (userRequest) => {
                        logger.info(`Processing order request: ${userRequest}`);
                        await SELF.sendMessage("Đang xử lý yêu cầu của bạn...", chatId);

                        const rawResponse = await LmService.getResponse(`
                            ${prompts.task_parser}

                            User Input: "${userRequest}"
                        `, false);

                        let parsedTask;
                        try {
                            const jsonStr = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
                            parsedTask = JSON.parse(jsonStr);
                        } catch (_e) {
                            logger.error(`Failed to parse AI response: ${rawResponse}`);
                            await SELF.sendMessage("Xin lỗi, tôi không hiểu được yêu cầu của bạn.", chatId);
                            return false;
                        }

                        if (!parsedTask.cron || !parsedTask.prompt) {
                            await SELF.sendMessage("Không thể tạo task từ yêu cầu của bạn.", chatId);
                            return false;
                        }

                        const cronRegex = /^((((\d+,)+\d+|(\d+(\/|-|#)\d+)|\d+L?|\*(\/\d+)?|L(-\d+)?|\?|[A-Z]{3}(-[A-Z]{3})?) ?){5,7})|(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every (\d+(ns|us|µs|ms|s|m|h))+)$/;
                        if (!cronRegex.test(parsedTask.cron)) {
                            await SELF.sendMessage(`Lỗi: Cron expression không hợp lệ: ${parsedTask.cron}`, chatId);
                            return false;
                        }

                        await DatabaseService.executeQuery(`
                            insert into tasks (cron, prompt, description, chat_id)
                            values (?, ?, ?, ?)
                        `, [parsedTask.cron, parsedTask.prompt, parsedTask.prompt, chatId]);

                        ScheduleService.syncNewJobs();

                        await SELF.sendMessage(
                            `Task đã được tạo thành công!\n\n` +
                            `Schedule: \`${parsedTask.cron}\`\n` +
                            `Hành động: ${parsedTask.prompt}`,
                            chatId
                        );
                        return true;
                    };

                    // Interactive flow: if session exists, user is providing the request
                    if (chatSession?.command === '/order') {
                        await processOrderRequest(messageText);
                        await RedisService.deleteData(`session_${chatId}`);
                        return res.status(200).json({ status: 'ok' });
                    }

                    // Check if user provided request directly with command
                    const directRequest = messageText.replace('/order', '').trim();
                    if (directRequest) {
                        await processOrderRequest(directRequest);
                        return res.status(200).json({ status: 'ok' });
                    }

                    // First call: ask user for their request
                    await RedisService.storeData(`session_${chatId}`, {
                        command: '/order',
                        data: {}
                    });
                    await SELF.sendMessage('Bạn muốn tạo task gì? Mô tả yêu cầu của bạn (ví dụ: "Nhắc tôi tập thể dục mỗi sáng lúc 7 giờ").', chatId);
                    return res.status(200).json({ status: 'ok' });
                } catch (error) {
                    logger.error(`Error in /order: ${error.stack}`);
                    const chatId = req.body.message.chat.id;
                    await SELF.sendMessage("Đã có lỗi xảy ra. Vui lòng thử lại sau.", chatId);
                    return res.status(200).json({ status: 'ok' });
                }
            }
        },
        '/ask': {
            description: 'Đặt câu hỏi cho AI và nhận được phản hồi',
            isConversationCommand: false,
            execute: async (req, res, chatSession) => {
                try {
                    const chatId = req.body.message.chat.id;
                    const messageText = req.body.message.text.trim();

                    // Interactive flow: if session exists, user is providing the question
                    if (chatSession?.command === '/ask') {
                        const prompt = messageText;
                        if (!prompt) {
                            await SELF.sendMessage('Vui lòng cung cấp câu hỏi của bạn.', chatId);
                            return res.status(200).json({ status: 'ok' });
                        }
                        const replyMsg = await LmService.getResponse(prompt);
                        await SELF.sendMessage(replyMsg, chatId);
                        await RedisService.deleteData(`session_${chatId}`);
                        return res.status(200).json({ status: 'ok' });
                    }

                    // Check if user provided question directly with command
                    const msgParts = messageText.split(' ');
                    const directPrompt = msgParts.slice(1).join(' ').trim();
                    if (directPrompt) {
                        const replyMsg = await LmService.getResponse(directPrompt);
                        await SELF.sendMessage(replyMsg, chatId);
                        return res.status(200).json({ status: 'ok' });
                    }

                    // First call: ask user for their question
                    await RedisService.storeData(`session_${chatId}`, {
                        command: '/ask',
                        data: {}
                    });
                    await SELF.sendMessage('Bạn muốn hỏi gì?', chatId);
                    return res.status(200).json({ status: 'ok' });
                } catch (error) {
                    logger.error(`Error in /ask: ${error.stack}`);
                    return res.status(200).json({ status: 'ok' });
                }
            }
        },
        '/cancel': {
            description: 'Hủy thao tác hiện tại',
            isConversationCommand: true, // Allowed during conversation
            execute: async (req, res) => {
                const chatId = req.body.message.chat.id;
                const chatSession = await RedisService.getData(`session_${chatId}`);
                // if chat session is conversation
                if (chatSession?.command === '/startconversation') {
                    const conversation = await RedisService.getData(`conversation_${chatId}`);
                    if (conversation) {
                        await Promise.all([DatabaseService.executeQuery(`
                            insert into conversations (chat_id, messages, summary, created_at)
                            values (?, ?, ?, ?)
                        `, [chatId, JSON.stringify(conversation.messages), conversation.summary,
                            new Date(conversation.createdAt * 1000)]),
                        RedisService.deleteData(`conversation_${chatId}`)]);
                    }
                }
                await Promise.all([
                    RedisService.deleteData(`session_${chatId}`),
                    SELF.sendMessage(`Đã hủy thao tác.`, chatId)
                ]);
                return res.status(200).json({ status: 'ok' });
            }
        },
        '/deletetask': {
            description: 'Xóa một task theo ID',
            isConversationCommand: false,
            execute: async (req, res, chatSession) => {
                try {
                    const chatId = req.body.message.chat.id;
                    const messageText = req.body.message.text.trim();

                    // Interactive flow: if session exists, user is providing task ID
                    if (chatSession?.command === '/deletetask') {
                        const taskId = messageText.trim();
                        if (!taskId || Number.isNaN(Number(taskId))) {
                            await SELF.sendMessage('Vui lòng cung cấp ID task hợp lệ.', chatId);
                            return res.status(200).json({ status: 'ok' });
                        }
                        await DatabaseService.executeQuery(`
                            delete from tasks where id = ? and chat_id = ?
                        `, [taskId, chatId]);
                        await SELF.sendMessage(`Đã xóa task thành công.`, chatId);
                        await RedisService.deleteData(`session_${chatId}`);
                        return res.status(200).json({ status: 'ok' });
                    }

                    // Check if user provided task ID directly with command
                    const directTaskId = messageText.split(' ')[1];
                    if (directTaskId) {
                        if (Number.isNaN(Number(directTaskId))) {
                            await SELF.sendMessage('ID task không hợp lệ.', chatId);
                            return res.status(200).json({ status: 'ok' });
                        }
                        await DatabaseService.executeQuery(`
                            delete from tasks where id = ? and chat_id = ?
                        `, [directTaskId, chatId]);
                        await SELF.sendMessage(`Đã xóa task thành công.`, chatId);
                        return res.status(200).json({ status: 'ok' });
                    }

                    // First call: ask user for task ID
                    await RedisService.storeData(`session_${chatId}`, {
                        command: '/deletetask',
                        data: {}
                    });
                    await SELF.sendMessage('Bạn muốn xóa task nào? Vui lòng cung cấp ID của task.', chatId);
                    return res.status(200).json({ status: 'ok' });
                } catch (error) {
                    logger.error(`Error in /deletetask: ${error.stack}`);
                    return res.status(200).json({ status: 'ok' });
                }
            }
        },
        '/startconversation': {
            description: "Tạo cuộc hội thoại",
            isConversationCommand: true,
            execute: async (req, res) => {
                try {
                    const chatId = req.body.message.chat.id;
                    const chatSession = await RedisService.getData(`session_${chatId}`); // 5 minutes
                    if (chatSession) {
                        const userMessage = req.body.message.text;
                        const conversationKey = `conversation_${chatId}`;
                        let conversation = await RedisService.getData(conversationKey);
                        if (!conversation) {
                            conversation = {
                                messages: [],
                                summary: '',
                                createdAt: Math.floor(Date.now() / 1000)
                            };
                            await RedisService.storeData(conversationKey, conversation);
                        }
                        if (!Array.isArray(conversation.messages)) {
                            conversation.messages = [];
                        }
                        let replyMsg;
                        if (conversation?.summary) {
                            replyMsg = await LmService.getResponse(`
                                Continue the conversation with the user, using the following summary to guide your response:
                                <last_2_messages>
                                ${conversation.messages.slice(-2).map(message => `${message.role}: ${message.content}`).join('\n')}
                                </last_2_messages>
                                <summary>
                                ${conversation.summary}
                                </summary>
                                <user_message>
                                ${userMessage}
                                </user_message>
                            `);
                        } else replyMsg = await LmService.getResponse(userMessage);
                        await SELF.sendMessage(replyMsg, chatId);
                        const summary = await LmService.getResponse(`
                            Summarize the question and answer into a concise summary (<200 characters) that captures its main intent:
                            <question>
                            ${userMessage}
                            </question>
                            <answer>
                            ${replyMsg}
                            </answer>
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
                        await RedisService.storeData(conversationKey, conversation);
                        return res.status(200).json({ status: 'ok' });
                    }
                    await Promise.all([
                        SELF.sendMessage(`Hello, how can I help you today?`, chatId),
                        RedisService.storeData(`session_${chatId}`, {
                            command: '/startconversation',
                        }),
                        RedisService.storeData(`conversation_${chatId}`, {
                            messages: [],
                            summary: '',
                            createdAt: Math.floor(Date.now() / 1000)
                        })
                    ]);
                    return res.status(200).json({ status: 'ok' });
                } catch (error) {
                    logger.error(`Error in /startconversation: ${error.stack}`);
                    return res.status(200).json({ status: 'ok' });
                }
            }
        },
        '/stopconversation': {
            description: "Kết thúc cuộc hội thoại",
            isConversationCommand: true, // Allowed during conversation
            execute: async (req, res) => {
                try {
                    const chatId = req.body.message.chat.id;
                    const chatSession = await RedisService.getData(`session_${chatId}`);
                    if (chatSession?.command === '/startconversation') {
                        // Save conversation to database before ending
                        const conversation = await RedisService.getData(`conversation_${chatId}`);
                        if (conversation && conversation.messages?.length > 0) {
                            await DatabaseService.executeQuery(`
                                insert into conversations (chat_id, messages, summary, created_at)
                                values (?, ?, ?, ?)
                            `, [chatId, JSON.stringify(conversation.messages), conversation.summary,
                                new Date(conversation.createdAt * 1000)]);
                        }
                        await Promise.all([
                            RedisService.deleteData(`session_${chatId}`),
                            RedisService.deleteData(`conversation_${chatId}`),
                            SELF.sendMessage(`Đã kết thúc cuộc hội thoại.`, chatId)
                        ]);
                        return res.status(200).json({ status: 'ok' });
                    }
                    await SELF.sendMessage(`Bạn không trong cuộc hội thoại nào.`, chatId);
                    return res.status(200).json({ status: 'ok' });
                } catch (error) {
                    logger.error(`Error in /stopconversation: ${error.stack}`);
                    return res.status(200).json({ status: 'ok' });
                }
            }
        }
    }


    return {
        setupWebhook: async () => {
            const url = `${SELF.API_URL}/setWebhook?url=${encodeURIComponent(SELF.WEBHOOK_URL)}`;
            logger.info(`Setting webhook to: ${url}`);
            const response = await fetch(url);
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
                const message = update?.message;
                const messageText = message?.text;
                if (!message || !messageText) {
                    return res.status(200).json({ status: 'ok' });
                }

                const chatId = message.chat.id;
                const chatSession = await RedisService.getData(`session_${chatId}`);
                logger.info(`Chat session: ${JSON.stringify(chatSession, null, 2)}`);

                // Check if user is in conversation mode
                const isInConversation = chatSession?.command === '/startconversation';

                if (messageText.startsWith('/')) {
                    const command = messageText.split(' ')[0];
                    const commandHandler = COMMAND_HANDLERS[command];

                    if (!commandHandler) {
                        return res.status(200).json({ status: 'Invalid command' });
                    }

                    // If user is in conversation, only allow conversation-related commands
                    if (isInConversation && !commandHandler.isConversationCommand) {
                        // This message should be excluded from AI context
                        await SELF.sendMessage(
                            `Bạn đang trong cuộc hội thoại. Vui lòng dùng /stopconversation để kết thúc hoặc /cancel để hủy trước khi sử dụng lệnh khác.`,
                            chatId,
                            { excludeFromContext: true }
                        );
                        return res.status(200).json({ status: 'ok' });
                    }

                    return commandHandler.execute(req, res, chatSession);
                }

                // Non-command message handling
                if (chatSession?.command) {
                    const commandHandler = COMMAND_HANDLERS[chatSession.command];
                    if (commandHandler) return commandHandler.execute(req, res, chatSession);
                    await RedisService.deleteData(`session_${chatId}`);
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
            const commands = Object.keys(COMMAND_HANDLERS).map(command => ({
                command: command,
                description: COMMAND_HANDLERS[command].description
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

export default TelegramService();