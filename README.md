# Telegram Chat Bot

Một bot chat Telegram đơn giản được xây dựng bằng Node.js, sử dụng chỉ API Telegram mà không cần thư viện ngoài.

## Tính năng

- Nhận và xử lý tin nhắn từ Telegram qua webhook
- Gửi tin nhắn phản hồi tự động
- Bot echo đơn giản (có thể tùy chỉnh logic)

## Cài đặt

1. Clone repository:
```bash
git clone <repository-url>
cd telegram-chat-bot
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```

4. Cấu hình biến môi trường trong file `.env`:

```env
# Telegram Bot Configuration
# Lấy bot token từ @BotFather trên Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Server Configuration
PORT=3000

# Webhook Configuration (optional)
# Đặt URL webhook công khai khi deploy
# Ví dụ: https://your-domain.com/webhook/telegram
WEBHOOK_URL=
```

## Chạy bot

### Development (local)

1. Chạy server:
```bash
npm start
```

2. Để Telegram gửi webhook đến local server, bạn cần:
   - Cài đặt ngrok: https://ngrok.com/download
   - Chạy: `ngrok http 3000`
   - Copy HTTPS URL từ ngrok
   - Đặt WEBHOOK_URL trong .env hoặc gọi API trực tiếp:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<NGROK_URL>/webhook/telegram
   ```

### Production

1. Deploy server lên hosting có HTTPS (Heroku, Vercel, AWS, etc.)
2. Đặt `WEBHOOK_URL` trong environment variables
3. Server sẽ tự động thiết lập webhook khi khởi động

## API Endpoints

- `POST /webhook/telegram` - Webhook endpoint để nhận tin nhắn từ Telegram
- `GET /health` - Health check
- `GET /` - Thông tin server

## Cách hoạt động

1. Telegram gửi tin nhắn đến webhook endpoint
2. `chatController.handleWebhook()` xử lý tin nhắn
3. `chatController.processMessage()` tạo phản hồi
4. `telegramService.sendMessage()` gửi tin nhắn qua Telegram API

## Tùy chỉnh Bot Logic

Chỉnh sửa function `processMessage()` trong `controllers/chatController.js` để thay đổi logic bot:

```javascript
SELF.processMessage = async function(chatId, text, messageId) {
    // Thêm logic của bạn ở đây
    let responseText = 'Phản hồi tùy chỉnh';
    await telegramService.sendReply(chatId, responseText, messageId);
};
```

## Tạo Bot Telegram

1. Mở Telegram và tìm @BotFather
2. Gửi `/newbot` và làm theo hướng dẫn
3. Sao chép bot token và đặt vào `TELEGRAM_BOT_TOKEN`

## Lưu ý

- Webhook yêu cầu HTTPS trong production
- Bot token phải được giữ bí mật
- Server sẽ tự động xóa webhook khi tắt (graceful shutdown)