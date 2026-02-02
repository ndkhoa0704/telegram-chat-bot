const { RedisClient } = require("bun");
const logger = require('../utils/log.util');


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

    return {
        /**
         * Check if Redis is connected
         * @returns {boolean}
         */
        isConnected: () => {
            return SELF.client !== null;
        },
        connect: async () => {
            const redisUrl = SELF.buildRedisUrl();
            logger.debug(`Connecting to Redis at ${redisUrl}`);
            if (!SELF.client) {
                SELF.client = new RedisClient(redisUrl);
                if (typeof SELF.client.on === 'function') {
                    SELF.client.on("error", (err) => {
                        logger.error(`Redis client error: ${err.stack}`);
                    });
                } else if (typeof SELF.client.addEventListener === 'function') {
                    SELF.client.addEventListener("error", (event) => {
                        logger.error(`Redis client error: ${event?.message || event}`);
                    });
                }
                await SELF.client.connect();
            }
            return SELF.client;
        },
        /**
         * Get the underlying Redis client
         * @returns {import("bun").RedisClient|null}
         */
        getClient: () => {
            return SELF.client;
        },
        storeData: async (key, data, options = {}) => {
            if (!SELF.client) {
                await module.exports.connect();
            }
            const redisKey = SELF.buildKey(key);
            const value = JSON.stringify(data);

            // Bun's RedisClient.set() doesn't accept options object
            // Use send() method for options like EX, PX, NX, XX
            if (options.EX || options.PX || options.NX || options.XX || options.EXAT || options.PXAT) {
                const args = [redisKey, value];
                if (options.EX) args.push('EX', String(options.EX));
                if (options.PX) args.push('PX', String(options.PX));
                if (options.EXAT) args.push('EXAT', String(options.EXAT));
                if (options.PXAT) args.push('PXAT', String(options.PXAT));
                if (options.NX) args.push('NX');
                if (options.XX) args.push('XX');
                await SELF.client.send('SET', args);
            } else {
                // Simple set without options
                await SELF.client.set(redisKey, value);
            }
        },
        getKeysByPrefix: async (prefix) => {
            if (!SELF.client) {
                await module.exports.connect();
            }
            let cursor = '0';
            let keys = [];
            do {
                // Bun's Redis client returns [nextCursor, keys] array format
                const result = await SELF.client.send('SCAN', [cursor, 'MATCH', `${SELF.PREFIX}${prefix}*`, 'COUNT', '1000']);
                cursor = String(result[0]);
                keys = keys.concat(result[1] || []);
            } while (cursor !== '0');
            return keys.map((key) => key.startsWith(SELF.PREFIX)
                ? key.slice(SELF.PREFIX.length)
                : key);
        },
        getData: async (key) => {
            if (!SELF.client) {
                await module.exports.connect();
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
                await module.exports.connect();
            }
            await SELF.client.del(SELF.buildKey(key));
        },
        disconnect: async () => {
            if (SELF.client) {
                await SELF.client.close();
                SELF.client = null;
            }
        },
    }
}

module.exports = RedisService();