
const logger = require('../utils/logUtil');
const RedisService = require('./redisService');
const commandHandlers = require('./commandHandlers');

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
                    const commandHandler = commandHandlers[command];
                    if (commandHandler) return commandHandler.execute(req, res);
                    return res.status(200).json({ status: 'Invalid command' });
                }

                logger.info(`Chat session: ${JSON.stringify(chatSession, null, 2)}`);
                if (chatSession?.command) {
                    const commandHandler = commandHandlers[chatSession.command];
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
            const commands = Object.keys(commandHandlers).map(command => ({
                command: command,
                description: commandHandlers[command].description
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