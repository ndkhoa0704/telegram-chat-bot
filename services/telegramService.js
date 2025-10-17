const LmService = require('./lmService');
const PostgresService = require('./databaseService');


function TelegramService() {
    const SELF = {
        CHAT_SESSSIONS: {

        },
        BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        API_URL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`,
        WEBHOOK_URL: `https://${process.env.TELEGRAM_WEBHOOK_URL}/api/webhook`,
        SEND_MSG_URL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        sendMessage: async (req, res, msg) => {
            const postData = {
                chat_id: req.body.message.chat.id,
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
            if (!response.ok) return res.status(500).json({ error: response.error });
            return res.status(200).json({ status: 'ok' });
        },
        COMMANDS: {
            '/tasks': async (req, res) => {
                try {
                    const tasks = await PostgresService.executeQuery(`
                        select cron, prompt, description
                        from tasks
                    `)
                    const msg = tasks?.length ? tasks.map(task => `- ${task.cron} - ${task.name}`).join('\n') : 'No tasks found'
                    const response = await SELF.sendMessage(msg, req.body.message.chat.id);
                    if (!response.ok) return res.status(500).json({ error: response.error });
                    return res.status(200).json({ status: 'ok' });
                } catch (error) {
                    console.error(error);
                    return res.status(500).json({ error: error.message });
                }
            },
            '/createtask': async (req, res) => {
                try {
                    const description = await LmService.getResponse(`
                        Summarize the given AI prompt into a concise description (<200 characters) that captures its main intent:\
                        ${prompt}
                    `);

                    await PostgresService.executeQuery(`
                        insert into tasks (cron, prompt, description)
                        values ($1, $2, $3)
                    `, [cron, prompt, description]);

                    return SELF.sendMessage(req, res, `Task created successfully`);
                } catch (error) {
                    console.error(error);
                    return res.status(500).json({ error: error.message });
                }
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
                if (currentChatSession) {
                    

                }

                if (update.message.text.startsWith('/')) {
                    const command = update.message.text.split(' ')[0];
                    const commandHandler = SELF.COMMANDS[command];
                    if (commandHandler) return commandHandler(req, res);
                    else return res.status(200).json({ status: 'ok' });
                }
                return res.status(200).json({ status: 'ok' });

            } catch (error) {
                console.error('Error processing webhook:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        },
    }
}

module.exports = TelegramService();