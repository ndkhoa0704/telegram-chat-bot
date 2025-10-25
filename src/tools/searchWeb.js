const logger = require('../utils/logUtil');

module.exports = {
    type: "function",
    function: {
        name: "webSearch",
        description: "Search the web for up-to-date information",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search query",
                    minLength: 1,
                    maxLength: 100
                }
            },
            required: ["query"]
        }
    },
    execute: async ({ query }) => {
        const params = new URLSearchParams({
            q: query,
            country: 'ALL'
        });
        const url = `https://api.search.brave.com/res/v1/web/search?${params}`
        const headers = {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY,
        }

        const response = await fetch(url, { headers });
        const data = await response.json();
        const results = data.web.results;

        logger.info(`Tool searchWeb called: ${JSON.stringify(results, null, 2)}`);
        return results.map(result => ({
            title: result.title,
            url: result.url,
            content: result.description.slice(0, 1000), // take just the first 1000 characters
        }));
    },
}