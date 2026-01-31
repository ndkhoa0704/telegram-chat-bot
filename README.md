## Installation

- Cài đặt Bun và Redis. SQLite dùng file cục bộ, không cần cài server.
- Chạy `bun install` để cài thư viện phụ thuộc.
- Sao chép `.env.example` thành `.env` và cập nhật giá trị phù hợp.
- Tùy chọn Docker: chạy `docker compose up --build` để khởi tạo server và Redis.

## Khởi chạy bằng Docker

- Đảm bảo `.env` đã được cấu hình đầy đủ.
- Lần đầu hoặc khi thay đổi phụ thuộc, chạy `docker compose up --build -d` để tạo và khởi động container nền.
- Theo dõi log dịch vụ chính với `docker compose logs -f server`.
- Dừng toàn bộ stack khi không dùng nữa: `docker compose down`.

## Commands

- `/tasks`: Liệt kê các tác vụ đã lên lịch với cron tương ứng.
- `/createtask`: Khởi tạo quy trình tạo tác vụ mới theo hai bước (cron ➜ prompt).
- `/ask <prompt>`: Gửi câu hỏi tùy ý và nhận phản hồi từ mô hình AI.
- `/cancel`: Hủy phiên làm việc hiện tại trong Redis.

## Thông tin môi trường (.env.example)

- `WEB_PORT`: Cổng HTTP để khởi chạy server Express.
- `TELEGRAM_BOT_TOKEN`: Token bot Telegram dùng để gửi/nhận tin nhắn.
- `TELEGRAM_WEBHOOK_URL`: Domain công khai để Telegram gọi webhook (`https://<domain>/api/webhook`).
- `SQLITE_PATH`: Đường dẫn file SQLite (ví dụ `data/bot.db`).
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: Thông số kết nối Redis.
- `OPENROUTER_API_KEY`: API key sử dụng dịch vụ OpenRouter.
- `CHAT_MODEL`: Tên mô hình chat trên OpenRouter (ví dụ `openai/gpt-4`, `anthropic/claude-3-opus`).
- `FILES_FOLDER_PATH`: Đường dẫn thư mục chứa tài liệu `.docx` để lập chỉ mục.
- `BRAVE_SEARCH_API_KEY`: API key cho công cụ tìm kiếm Brave (dùng trong tool).

