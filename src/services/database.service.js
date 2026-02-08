const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');


function DatabaseService() {
    const self = {
        /** @type {import('better-sqlite3').Database} */
        db: null,
    }

    return {
        /**
         * Check if database is connected
         * @returns {boolean}
         */
        isConnected: () => {
            return self.db !== null;
        },

        /**
         * Connect to SQLite database
         */
        connect: async () => {
            if (self.db) return self.db;

            const sqlitePath = process.env.SQLITE_PATH || path.join('data', 'bot.db');
            const dbDir = path.dirname(sqlitePath);

            // Create directory if it doesn't exist
            if (dbDir && !fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            // Initialize better-sqlite3 Database
            self.db = new Database(sqlitePath);

            // Recommended optimizations for SQLite
            self.db.pragma('journal_mode = WAL');
            self.db.pragma('synchronous = NORMAL');
            self.db.pragma('foreign_keys = ON');

            return self.db;
        },

        /**
         * Disconnect from database
         * @returns {Promise<void>}
         */
        disconnect: async () => {
            if (self.db) {
                self.db.close();
                self.db = null;
            }
        },

        /**
         * Executes a SQL query using better-sqlite3
         * @param {string} queryString - SQL query to execute
         * @param {Array|Object} params - Query parameters
         * @returns {Promise<any>}
         */
        executeQuery: async (queryString, params = []) => {
            // Ensure connection
            if (!self.db) {
                await module.exports.connect();
            }

            try {
                let sqlText = queryString;
                let sqlParams = params;

                // Allow tagged template input (for compatibility)
                if (queryString && typeof queryString === 'object' && queryString.sql) {
                    sqlText = queryString.sql;
                    sqlParams = queryString.values || [];
                }

                // Normalize params to array
                const safeParams = Array.isArray(sqlParams) ? sqlParams : [sqlParams];

                // Determine operation type
                const operation = String(sqlText).trim().toLowerCase();
                const isReadOperation = /^(select|pragma|with|explain)\b/.test(operation);

                if (isReadOperation) {
                    // Use prepare().all() for SELECT operations
                    const stmt = self.db.prepare(sqlText);
                    return stmt.all(...safeParams);
                } else {
                    // Use prepare().run() for INSERT, UPDATE, DELETE, etc.
                    const stmt = self.db.prepare(sqlText);
                    return stmt.run(...safeParams);
                }
            } catch (error) {
                console.error('Database Query Error:', error);
                console.error('Query:', queryString);
                console.error('Params:', params);
                throw error;
            }
        },

        /**
         * Executes a SQL query using tagged template (compatibility method)
         * @param {Object} query - tagged template query object
         * @returns {Promise<any>}
         */
        executeSql: async (query) => {
            return module.exports.executeQuery(query);
        },

        /**
         * Execute a transaction
         * @param {Function} callback - Function to execute within transaction
         * @returns {Promise<any>}
         */
        transaction: async (callback) => {
            if (!self.db) {
                await module.exports.connect();
            }

            const txn = self.db.transaction(callback);
            return txn();
        },

        /**
         * Get the underlying database instance
         * @returns {import('better-sqlite3').Database}
         */
        getDb: () => {
            return self.db;
        }
    };
}

module.exports = DatabaseService();