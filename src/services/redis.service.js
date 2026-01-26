const redis = require('redis');
const logger = require('../utils/log.util');

function RedisService() {
    const SELF = {
        client: null,
        PREFIX: 'telegram_chat_bot:',
    }
    return {
        connect: async () => {
            logger.debug(`Connecting to Redis at ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
            if (!SELF.client) {
                SELF.client = redis.createClient({
                    socket: {
                        host: process.env.REDIS_HOST,
                        port: process.env.REDIS_PORT,
                    },
                    password: process.env.REDIS_PASSWORD,
                });
                SELF.client.on('error', (err) => {
                    logger.error(`Redis client error: ${err.stack}`);
                });
                await SELF.client.connect();
            }
            return SELF.client;
        },
        storeData: async (key, data, options = {}) => {
            await SELF.client.set(SELF.PREFIX + key, JSON.stringify(data), options);
        },
        getKeysByPrefix: async (prefix) => {
            let cursor = 0;
            let keys = [];
            do {
                const result = await SELF.client.scan(cursor, 'MATCH', `${SELF.PREFIX}${prefix}*`, 'COUNT', 1000);
                cursor = result.cursor;
                keys = keys.concat(result.keys);
            } while (cursor !== 0);
            return keys.map((key) => key.startsWith(SELF.PREFIX)
                ? key.slice(SELF.PREFIX.length)
                : key);
        },
        getData: async (key) => {
            const data = await SELF.client.get(SELF.PREFIX + key);
            try {
                return JSON.parse(data);
            } catch (_) {
                return data;
            }
        },
        deleteData: async (key) => {
            await SELF.client.del(SELF.PREFIX + key);
        },
        disconnect: async () => {
            await SELF.client.close();
        },
    }
}

module.exports = RedisService();