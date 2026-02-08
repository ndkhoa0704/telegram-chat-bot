import { createClient } from 'redis';
import logger from '../utils/log.util.js';


function RedisService() {
    const SELF = {
        client: null,
        PREFIX: 'telegram_chat_bot:',
        buildKey: (key) => SELF.PREFIX + key,
        buildRedisUrl: () => {
            const envUrl = process.env.REDIS_URL || process.env.VALKEY_URL;
            if (envUrl) return envUrl;

            const host = process.env.REDIS_HOST || 'localhost';
            const port = process.env.REDIS_PORT || '6379';
            const url = new URL(`redis://${host}:${port}`);
            if (process.env.REDIS_PASSWORD) {
                url.password = process.env.REDIS_PASSWORD;
            }
            return url.toString();
        },
    }

    const service = {
        /**
         * Check if Redis is connected
         * @returns {boolean}
         */
        isConnected: () => {
            return SELF.client !== null && SELF.client.isOpen;
        },
        connect: async () => {
            const redisUrl = SELF.buildRedisUrl();
            logger.debug(`Connecting to Redis at ${redisUrl}`);
            if (!SELF.client) {
                SELF.client = createClient({ url: redisUrl });
                SELF.client.on('error', (err) => {
                    logger.error(`Redis client error: ${err.stack || err}`);
                });
                await SELF.client.connect();
            }
            return SELF.client;
        },
        /**
         * Get the underlying Redis client
         * @returns {import('redis').RedisClientType|null}
         */
        getClient: () => {
            return SELF.client;
        },
        storeData: async (key, data, options = {}) => {
            if (!SELF.client) {
                await service.connect();
            }
            const redisKey = SELF.buildKey(key);
            const value = JSON.stringify(data);

            // node-redis v5 accepts options object directly in set()
            const setOptions = {};
            if (options.EX) setOptions.EX = options.EX;
            if (options.PX) setOptions.PX = options.PX;
            if (options.EXAT) setOptions.EXAT = options.EXAT;
            if (options.PXAT) setOptions.PXAT = options.PXAT;
            if (options.NX) setOptions.NX = true;
            if (options.XX) setOptions.XX = true;

            if (Object.keys(setOptions).length > 0) {
                await SELF.client.set(redisKey, value, setOptions);
            } else {
                await SELF.client.set(redisKey, value);
            }
        },
        getKeysByPrefix: async (prefix) => {
            if (!SELF.client) {
                await service.connect();
            }
            let cursor = 0;
            let keys = [];
            do {
                // node-redis v5 scan method returns { cursor, keys }
                const result = await SELF.client.scan(cursor, {
                    MATCH: `${SELF.PREFIX}${prefix}*`,
                    COUNT: 1000
                });
                cursor = result.cursor;
                keys = keys.concat(result.keys || []);
            } while (cursor !== 0);
            return keys.map((key) => key.startsWith(SELF.PREFIX)
                ? key.slice(SELF.PREFIX.length)
                : key);
        },
        getData: async (key) => {
            if (!SELF.client) {
                await service.connect();
            }
            const data = await SELF.client.get(SELF.buildKey(key));
            try {
                return JSON.parse(data);
            } catch (_) {
                return data;
            }
        },
        deleteData: async (key) => {
            if (!SELF.client) {
                await service.connect();
            }
            await SELF.client.del(SELF.buildKey(key));
        },
        disconnect: async () => {
            if (SELF.client) {
                await SELF.client.quit();
                SELF.client = null;
            }
        },
    };

    return service;
}

export default RedisService();