const logger = require('../utils/logUtil');

module.exports = {
    type: "function",
    function: {
        name: "currentTimeStamp",
        description: "Get the current date and time",
        parameters: {
            type: "object",
            properties: {
            },
            required: []
        }
    },
    execute: async () => {
        const result = new Date().toISOString();
        logger.info(`Tool currentTimeStamp called: ${result}`);
        return {
            currentTimeStamp: result,
        }
    },
}