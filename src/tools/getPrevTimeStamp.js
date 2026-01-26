const logger = require('../utils/log.util');

module.exports = {
    type: "function",
    function: {
        name: "getPrevTimeStamp",
        description: "Get the previous date and time",
        parameters: {
            type: "object",
            properties: {
            },
            required: []
        }
    },
    execute: async () => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        const result = date.toISOString();
        logger.info(`Tool getPrevTimeStamp called: ${result}`);
        return {
            prevTimeStamp: result,
        }
    },
}