const https = require('https');

function TelegramService() {
    const SELF = {}

    // Get bot token from environment variables
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const API_BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

    /**
     * Send a message to a Telegram chat
     * @param {string} chatId - The chat ID to send message to
     * @param {string} text - The message text to send
     * @param {object} options - Additional options (parse_mode, reply_markup, etc.)
     * @returns {Promise} - Promise that resolves with the API response
     */
    SELF.sendMessage = (chatId, text, options = {}) => {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                chat_id: chatId,
                text: text,
                ...options
            });

            const url = `${API_BASE_URL}/sendMessage`;
            const parsedUrl = new URL(url);

            const requestOptions = {
                hostname: parsedUrl.hostname,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(requestOptions, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.ok) {
                            resolve(response);
                        } else {
                            reject(new Error(`Telegram API Error: ${response.description}`));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(postData);
            req.end();
        });
    };

    /**
     * Send a reply to a message
     * @param {string} chatId - The chat ID
     * @param {string} text - The reply text
     * @param {number} replyToMessageId - The message ID to reply to
     * @param {object} options - Additional options
     */
    SELF.sendReply = (chatId, text, replyToMessageId, options = {}) => {
        return SELF.sendMessage(chatId, text, {
            reply_to_message_id: replyToMessageId,
            ...options
        });
    };

    /**
     * Set webhook for receiving messages
     * @param {string} webhookUrl - The webhook URL
     * @returns {Promise} - Promise that resolves with the API response
     */
    SELF.setWebhook = (webhookUrl) => {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                url: webhookUrl
            });

            const url = `${API_BASE_URL}/setWebhook`;
            const parsedUrl = new URL(url);

            const requestOptions = {
                hostname: parsedUrl.hostname,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(requestOptions, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.ok) {
                            resolve(response);
                        } else {
                            reject(new Error(`Telegram API Error: ${response.description}`));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(postData);
            req.end();
        });
    };

    /**
     * Delete webhook
     * @returns {Promise} - Promise that resolves with the API response
     */
    SELF.deleteWebhook = () => {
        return new Promise((resolve, reject) => {
            const url = `${API_BASE_URL}/deleteWebhook`;
            const parsedUrl = new URL(url);

            const requestOptions = {
                hostname: parsedUrl.hostname,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const req = https.request(requestOptions, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.ok) {
                            resolve(response);
                        } else {
                            reject(new Error(`Telegram API Error: ${response.description}`));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.end();
        });
    };

    return SELF;
}

module.exports = TelegramService();