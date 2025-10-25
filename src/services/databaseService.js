const pg = require('pg');
const { types } = require('pg');
// const pgvector = require('pgvector/pg');
types.setTypeParser(1700, (val) => val === null ? null : Number(val));


function PostgresService() {
    const self = {
        pool: null,
    }
    return {
        isConnected: () => {
            return self.pool !== null;
        },
        connect: () => {
            return new Promise((resolve, _reject) => {
                if (self.pool) return self.pool;
                const pool = new pg.Pool({
                    host: process.env.PG_HOSTNAME,
                    port: process.env.PG_PORT,
                    database: process.env.PG_DATABASE,
                    user: process.env.PG_USERNAME,
                    password: process.env.PG_PASSWORD,
                });
                // pool.on('connect', async (client) => {
                //     await pgvector.registerTypes(client);
                // });

                self.pool = pool;
                resolve(pool);
            });
        },
        disconnect: async () => {
            if (self.pool) {
                await self.pool.end();
                self.pool = null;
            }
        },
        executeQuery: async (query, params = []) => {
            const client = await self.pool.connect();
            let transactionStarted = false;
            try {
                const operation = query.trim().toLowerCase();
                if (/^(insert|update|delete|create|drop|alter)/i.test(operation)) {
                    transactionStarted = true;
                    await client.query('BEGIN');
                }

                const result = await client.query(query, params);

                if (transactionStarted) {
                    await client.query('COMMIT');
                }

                return result.rows;
            } catch (error) {
                if (transactionStarted) {
                    try {
                        await client.query('ROLLBACK');
                    } catch (rollbackError) {
                        console.error('Rollback failed:', rollbackError);
                    }
                }
                throw error;
            } finally {
                client.release();
            }
        }
    };
}

module.exports = PostgresService();