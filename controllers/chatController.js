const telegramService = require('../services/telegramService');

function ChatController() {
    const SELF = {}

    /**
     * Handle incoming webhook messages from Telegram
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    SELF.handleWebhook = async (req, res) => {
        try {
            const update = req.body;

            // Check if this is a message update
            if (update?.message) {
                const message = update.message;
                const chatId = message.chat.id;
                const text = message.text;
                const messageId = message.message_id;

                console.log(`Received message from chat ${chatId}: ${text}`);

                // Process the message (you can add your bot logic here)
                await SELF.processMessage(chatId, text, messageId);
            }

            // Always respond with 200 OK to acknowledge receipt
            res.status(200).json({ status: 'ok' });

        } catch (error) {
            console.error('Error handling webhook:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };

    /**
     * Process incoming messages and generate responses
     * @param {string} chatId - The chat ID
     * @param {string} text - The message text
     * @param {number} messageId - The message ID for replying
     */
    SELF.processMessage = async (chatId, text, messageId) => {
        try {
            let responseText = '';

            // Simple echo bot logic - you can replace this with your own logic
            if (text) {
                if (text.toLowerCase() === '/start') {
                    responseText = 'Chào mừng bạn đến với bot! Gửi tin nhắn để tôi trả lời.';
                } else if (text.toLowerCase() === '/help') {
                    responseText = 'Tôi là một bot chat đơn giản. Gửi bất kỳ tin nhắn nào để tôi echo lại!';
                } else {
                    responseText = `Bạn đã gửi: "${text}"`;
                }
            } else {
                responseText = 'Xin lỗi, tôi chỉ có thể xử lý tin nhắn văn bản.';
            }

            // Send the response
            await telegramService.sendReply(chatId, responseText, messageId);

        } catch (error) {
            console.error('Error processing message:', error);
            // Try to send an error message
            try {
                await telegramService.sendMessage(chatId, 'Xin lỗi, có lỗi xảy ra khi xử lý tin nhắn của bạn.');
            } catch (sendError) {
                console.error('Error sending error message:', sendError);
            }
        }
    };

    /**
     * Send a message to a specific chat
     * @param {string} chatId - The chat ID to send message to
     * @param {string} text - The message text
     * @param {object} options - Additional options
     */
    SELF.sendMessage = async (chatId, text, options = {}) => {
        try {
            const result = await telegramService.sendMessage(chatId, text, options);
            return result;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    };

    return SELF;
}

module.exports = ChatController();