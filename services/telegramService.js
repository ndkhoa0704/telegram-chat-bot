const LmService = require('./lmService');
const PostgresService = require('./databaseService');


function TelegramService() {
    const SELF = {
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        TELEGRAM_API_URL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`,
        TELEGRAM_WEBHOOK_URL: `https://${process.env.TELEGRAM_WEBHOOK_URL}/api/webhook`,
        COMMANDS: {
            '/tasks': async (_msg) => {
                try {
                    const tasks = await PostgresService.executeQuery(`
                        select cron, prompt, name
                        from tasks
                    `)
                    const msg = tasks.map(task => `- ${task.cron} - ${task.name}`).join('\n');
                    return msg

                } catch (error) {
                    console.error(error);
                }

            },
            '/createtask': async msg => {
                try {
                    const [_, content] = msg.text.split(' ');
                    if (!content) {
                        return 'Usage: /createtask <cron> - <prompt>';
                    }
                    const [cron, prompt] = content.split(' - ');
                    const description = await LmService.getResponse(`
                        Summarize the given AI prompt into a concise description (≤100 characters) that captures its main intent.

                        ${prompt}
                        `);

                    
                    await PostgresService.executeQuery(`
                        insert into tasks (cron, prompt, description)
                        values ($1, $2, $3)
                    `, [cron, prompt, description]);

                    return `Task created successfully`;
                } catch (error) {
                    console.error(error);
                }
            }
        }
    }

    return {
        setupWebhook: async () => {
            const response = await fetch(`${SELF.TELEGRAM_API_URL}/setWebhook?url=${SELF.TELEGRAM_WEBHOOK_URL}`);
            const data = await response.json();
            console.log(data);
        },
        deleteWebhook: async () => {
            const response = await fetch(`${SELF.TELEGRAM_API_URL}/deleteWebhook`);
            const data = await response.json();
            console.log('Delete webhook response:', data);
            return data;
        },
        sendReply: async (req, res) => {
            try {
                // Extract message data from webhook payload
                const update = req.body;

                console.log('Received message:', update);

                let replyText = null;

                if (update.message.text.startsWith('/')) {
                    const command = update.message.text.split(' ')[0];
                    console.log('Command:', command);
                    const commandHandler = SELF.COMMANDS[command];
                    if (commandHandler) {
                        replyText = await commandHandler(update.message);
                    } else {
                        replyText = 'Command not found';
                    }
                }

                if (!replyText) {
                    return res.status(200).json({ status: 'ok' });
                }

                const postData = {
                    chat_id: update.message.chat.id,
                    text: replyText,
                    parse_mode: 'markdown'
                };

                const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(postData)
                });

                const data = await response.json();

                if (response.ok) {
                    console.log('Reply sent successfully');
                    res.status(200).json({ status: 'ok' });
                } else {
                    console.error('Failed to send reply:', data);
                    res.status(500).json({ error: 'Failed to send reply' });
                }
            } catch (error) {
                console.error('Error processing webhook:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        },
        sendMessage: async (chatId, message) => {
            const response = await fetch(`${SELF.TELEGRAM_API_URL}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(message)}`);
            const data = await response.json();
            console.log(data);
            return data;
        },
    }
}

module.exports = TelegramService();