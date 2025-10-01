const express = require('express');
const chatController = require('./controllers/chatController');
const telegramService = require('./services/telegramService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Webhook endpoint for Telegram
app.post('/webhook/telegram', chatController.handleWebhook);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Telegram Chat Bot Server',
        endpoints: {
            webhook: 'POST /webhook/telegram',
            health: 'GET /health'
        }
    });
});

// Start the server
app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Webhook endpoint: http://localhost:${PORT}/webhook/telegram`);
    console.log(`Health check: http://localhost:${PORT}/health`);

    // Optional: Set webhook URL if provided in environment
    const webhookUrl = process.env.WEBHOOK_URL;
    if (webhookUrl) {
        try {
            console.log('Setting webhook...');
            const result = await telegramService.setWebhook(webhookUrl);
            console.log('Webhook set successfully:', result.description);
        } catch (error) {
            console.error('Failed to set webhook:', error.message);
        }
    } else {
        console.log('No WEBHOOK_URL provided. You can manually set the webhook using:');
        console.log(`https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-domain.com/webhook/telegram`);
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');

    try {
        // Remove webhook on shutdown
        await telegramService.deleteWebhook();
        console.log('Webhook removed successfully');
    } catch (error) {
        console.error('Error removing webhook:', error.message);
    }

    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');

    try {
        // Remove webhook on shutdown
        await telegramService.deleteWebhook();
        console.log('Webhook removed successfully');
    } catch (error) {
        console.error('Error removing webhook:', error.message);
    }

    process.exit(0);
});
