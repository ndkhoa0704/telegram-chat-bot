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
        return new Date().toISOString();
    },
}