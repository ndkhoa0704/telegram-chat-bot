const { Database } = require('bun:sqlite');
const fs = require('node:fs');
const path = require('node:path');

function DatabaseService() {
    const self = {
        db: null,
    }
    return {
        isConnected: () => {
            return self.db !== null;
        },
        connect: () => {
            return new Promise((resolve) => {
                if (self.db) return resolve(self.db);
                const sqlitePath = process.env.SQLITE_PATH || path.join('data', 'bot.db');
                const dbDir = path.dirname(sqlitePath);
                if (dbDir && !fs.existsSync(dbDir)) {
                    fs.mkdirSync(dbDir, { recursive: true });
                }
                self.db = new Database(sqlitePath, { create: true });
                resolve(self.db);
            });
        },
        disconnect: async () => {
            if (self.db) {
                self.db.close();
                self.db = null;
            }
        },
        executeQuery: async (query, params = []) => {
            const statement = self.db.prepare(query);
            const operation = query.trim().toLowerCase();
            if (/^(select|pragma|with)\b/.test(operation)) {
                return statement.all(params);
            }
            statement.run(params);
            return [];
        }
    };
}

module.exports = DatabaseService();