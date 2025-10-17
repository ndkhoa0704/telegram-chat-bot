const { OpenAI } = require('openai');
const prompts = require('../prompts');
const Tools = require('../tools');
const PostgresService = require('./databaseService');
const fsPromises = require('node:fs').promises;




function LmService() {
    const SELF = {
        chatClient: null,
        embeddingClient: null,
        chatModel: null,
        embeddingModel: null,
        removeThinkBlock: (text) => {
            const parts = text.split('</think>')
            return parts[parts.length - 1]
        },
        init: () => {
            if (process.env.USE_LOCAL_AI) {
                SELF.chatClient = new OpenAI({
                    baseURL: process.env.LOCAL_CHAT_MODEL_URL,
                })
                SELF.chatModel = process.env.LOCAL_CHAT_MODEL
                SELF.embeddingClient = new OpenAI({
                    baseURL: process.env.LOCAL_EMBED_MODEL_URL,
                })
                SELF.embeddingModel = process.env.LOCAL_EMBED_MODEL
            } else {
                SELF.chatClient = new OpenAI({
                    apiKey: process.env.OPENAI_API_KEY,
                })
                SELF.chatModel = process.env.CHAT_MODEL
                SELF.embeddingClient = new OpenAI({
                    apiKey: process.env.OPENAI_API_KEY,
                })
                SELF.embeddingModel = process.env.EMBED_MODEL
            }
        },
        FILES_FOLDER_PATH: process.env.FILES_FOLDER_PATH,
        getEmbeddings: async (text) => {
            const response = await SELF.embeddingClient.embeddings.create({
                model: SELF.embeddingModel,
                input: text,
            })
            return response.data[0].embedding;
        },
    }
    SELF.init();
    return {
        getResponse: async (message) => {
            const response = await SELF.chatClient.chat.completions.create({
                model: SELF.chatModel,
                messages: [
                    { role: "system", content: prompts.limitWords(500) },
                    { role: "user", content: message }
                ],
            })

            return SELF.removeThinkBlock(response.choices[0].message.content)
        },
        saveDocumentsFromFolder: async () => {
            try {
                const files = await fsPromises.readdir(SELF.FILES_FOLDER_PATH);
                for (const file of files) {
                    if (file.endsWith('.docx')) {
                        const filename = file.split('.')[0];
                        const docx = await fsPromises.readFile(`${SELF.FILES_FOLDER_PATH}/${file}`);
                        const markdown = await SELF.docxToMarkdown(docx);
                        const embeding = await SELF.getEmbeddings(markdown);
                        await PostgresService.executeQuery(`
                            INSERT INTO document (filename, embeding)
                            VALUES ($1, $2)
                        `, [filename, embeding]);
                    }
                }
            } catch (error) {
                console.error(error);
            }
        }
    }
}


module.exports = LmService();