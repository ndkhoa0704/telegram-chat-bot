const openai = require('openai');


function LmService() {
    const SELF = {}
    return {
        sendMsg: async (msg) => {
            const client = new openai({
                apiKey: process.env.OPENAI_TOKEN,
                baseURL: process.env.OPENAI_API_URL
            })

            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: msg }]
            })

            return response.choices[0].message.content
        }
    }
}

module.exports = LmService();