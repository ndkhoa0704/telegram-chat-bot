const LmService = require('./lmService');
const PostgresService = require('./databaseService');


function TelegramService() {
    const SELF = {
        CHAT_SESSSIONS: {},
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
                console.error(response);
            }
        },
        commandHandlers: {
            '/tasks': async (req, res) => {
                try {
                    const chatId = req.body.message.chat.id;
                    const tasks = await PostgresService.executeQuery(`
                        select cron, prompt, description
                        from tasks
                    `)

                    const msg = tasks?.length
                        ? tasks.map(task =>
                            `\`${task.cron}\` - ${task.description}`).join('\n')
                        : 'No tasks found';
                    const response = await SELF.sendMessage(msg, chatId);
                    return res.status(200).json({ status: 'ok', response: response });
                } catch (error) {
                    console.error(error);
                    return res.status(500).json({ error: error.message });
                }
            },
            '/createtask': async (req, res) => {
                try {
                    const chatId = req.body.message.chat.id;
                    if (SELF.CHAT_SESSSIONS[chatId]) {
                        if (!SELF.CHAT_SESSSIONS[chatId]?.data?.cron) {
                            const cron = req.body.message.text.split(' - ')[0];
                            SELF.CHAT_SESSSIONS[chatId].data.cron = cron;
                            return SELF.sendMessage(`Give me your prompt`, chatId);
                        }
                        if (SELF.CHAT_SESSSIONS[chatId]?.data?.cron) {
                            const prompt = req.body.message.text;
                            SELF.CHAT_SESSSIONS[chatId].data.prompt = prompt;
                            const description = await LmService.getResponse(`
                                Summarize the given AI prompt into a concise description (<200 characters) that captures its main intent:\
                                ${prompt}
                            `);
                            const cron = SELF.CHAT_SESSSIONS[chatId].data.cron;
                            await PostgresService.executeQuery(`
                            insert into tasks (cron, prompt, description, chat_id)
                            values ($1, $2, $3, $4)
                            `, [cron, prompt, description.trim(), chatId]);
                            delete SELF.CHAT_SESSSIONS[chatId];
                            return SELF.sendMessage(`Task created successfully`, chatId);
                        }
                    }
                    SELF.CHAT_SESSSIONS[chatId] = {
                        command: '/createtask',
                        data: {
                            cron: '',
                        }
                    };
                    const response = await SELF.sendMessage(`Give me your cron`, chatId);
                    return res.status(200).json({ status: 'ok', response: response });
                } catch (error) {
                    console.error(error);
                    return res.status(500).json({ error: error.message });
                }
            },
            '/ask': async (req, res) => {
                try {
                    const chatId = req.body.message.chat.id;
                    const msgParts = req.body.message.text.split(' ');
                    const prompt = msgParts.slice(1).join(' ');
                    if (!prompt) return res.status(200).json({ status: 'ok', response: 'Please provide a prompt' });
                    const replyMsg = await LmService.getResponse(prompt);
                    const response = await SELF.sendMessage(replyMsg, chatId);
                    return res.status(200).json({ status: 'ok', response: response });
                } catch (error) {
                    console.error(error);
                    return res.status(500).json({ error: error.message });
                }
            },
            '/cancel': async (req, res) => {
                delete SELF.CHAT_SESSSIONS[req.body.message.chat.id];
                return SELF.sendMessage(req, res, `Command cancelled`);
            }
        }
    }

    return {
        setupWebhook: async () => {
            const response = await fetch(`${SELF.API_URL}/setWebhook?url=${SELF.WEBHOOK_URL}`);
            const data = await response.json();
            console.log(data);
        },
        deleteWebhook: async () => {
            const response = await fetch(`${SELF.API_URL}/deleteWebhook`);
            const data = await response.json();
            console.log('Delete webhook response:', data);
            return data;
        },
        sendReply: async (req, res) => {
            try {
                // Extract message data from webhook payload
                const update = req.body;

                const currentChatSession = SELF.CHAT_SESSSIONS[update.message.chat.id];
                if (currentChatSession?.command) {
                    const commandHandler = SELF.commandHandlers[currentChatSession.command];
                    if (commandHandler) return commandHandler(req, res);
                    delete SELF.CHAT_SESSSIONS[update.message.chat.id];
                    return res.status(200).json({ status: 'Invalid session' });
                }

                if (update.message.text.startsWith('/')) {
                    const command = update.message.text.split(' ')[0];
                    const commandHandler = SELF.commandHandlers[command];
                    if (commandHandler) return commandHandler(req, res);
                }
            } catch (error) {
                console.error('Error processing webhook:', error);
            }
        },
        sendMessage: async (msg, chatId) => {
            return SELF.sendMessage(msg, chatId);
        }
    }
}

module.exports = TelegramService();