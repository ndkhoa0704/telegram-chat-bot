import DatabaseService from '../services/database.service.js';

async function migrateTables() {
    await DatabaseService.executeQuery(`
        CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NULL,
        prompt TEXT NULL,
        cron TEXT NULL,
        chat_id TEXT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NULL
    );`)

    await DatabaseService.executeQuery(`
        CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NULL,
        messages TEXT NULL,
        summary TEXT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NULL
        );
    `)

    await DatabaseService.executeQuery(`
        CREATE TABLE IF NOT EXISTS document (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NULL,
        embeding TEXT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NULL
        );
    `)
}

DatabaseService.connect().then(async () => {
    await migrateTables();
    await DatabaseService.disconnect();
});