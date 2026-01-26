const { sql } = require('bun');
const { Database } = require('bun:sqlite');
const fs = require('node:fs');
const path = require('node:path');

function DatabaseService() {
    const self = {
        /** @type {import('bun:sqlite').Database} */
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

            // Initialize Bun SQLite Database
            self.db = new Database(sqlitePath, { create: true });

            // Recommended optimizations for SQLite
            self.db.run("PRAGMA journal_mode = WAL;");
            self.db.run("PRAGMA synchronous = NORMAL;");
            self.db.run("PRAGMA foreign_keys = ON;");

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
         * Executes a SQL query using bun:sqlite
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

                // Allow bun sql`` tagged template input
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
                    // Use query() for SELECT operations
                    const stmt = self.db.query(sqlText);
                    return stmt.all(...safeParams);
                } else {
                    // Use run() for INSERT, UPDATE, DELETE, etc.
                    const result = self.db.run(sqlText, ...safeParams);
                    return result;
                }
            } catch (error) {
                console.error('Database Query Error:', error);
                console.error('Query:', queryString);
                console.error('Params:', params);
                throw error;
            }
        },

        /**
         * Executes a SQL query using bun sql`` tagged template
         * @param {ReturnType<typeof sql>} query - bun sql tagged template
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
         * @returns {import('bun:sqlite').Database}
         */
        getDb: () => {
            return self.db;
        }
    };
}

module.exports = DatabaseService();