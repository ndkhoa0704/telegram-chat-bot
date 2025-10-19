const { OpenAI } = require('openai');
const prompts = require('../prompts');
const tools = require('../tools');
const PostgresService = require('./databaseService');
const fsPromises = require('node:fs').promises;
const logger = require('../utils/logUtil');


function LmService() {
    const SELF = {
        chatClient: null,
        embeddingClient: null,
        chatModel: null,
        embeddingModel: null,
        removeThinkBlock: (text) => {
            if (!text.includes('</think>')) return text;
            const parts = text.split('</think>')
            return parts[parts.length - 1]
        },
        FILES_FOLDER_PATH: process.env.FILES_FOLDER_PATH,
        getEmbeddings: async (text) => {
            const response = await SELF.embeddingClient.embeddings.create({
                model: SELF.embeddingModel,
                input: text,
            })
            return response.data[0].embedding;
        },
        MAX_TOOL_CALLS: 3
    }
    return {
        init: () => {
            if (process.env.USE_LOCAL_AI === '1') {
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
            logger.info(`${SELF.chatModel} initialized`);
            logger.info(`${SELF.embeddingModel} initialized`);
        },
        getResponse: async (message, toolUse = true) => {
            const messages = [
                { role: "system", content: prompts.limitWords(500) },
                { role: "user", content: message },
            ];
            if (toolUse) {
                for (let i = 0; i < SELF.MAX_TOOL_CALLS; i++) {
                    const response = await SELF.chatClient.chat.completions.create({
                        model: SELF.chatModel,
                        messages: messages,
                        tools: tools,
                        tool_choice: 'auto',
                    })
                    if (toolUse) {
                        const assistantMessage = response.choices[0].message;
                        const toolCalls = assistantMessage?.tool_calls;
                        if (!toolCalls?.length) {
                            return SELF.removeThinkBlock(assistantMessage?.content || '');
                        }
                        // include assistant tool_call message in history
                        messages.push(assistantMessage);
                        for (const toolCall of toolCalls) {
                            const toolName = toolCall.function.name;
                            const toolExecutor = tools.find(tool => tool.function.name === toolName);
                            const argsJson = toolCall.function?.arguments;
                            let args = {};
                            if (argsJson) {
                                try {
                                    args = JSON.parse(argsJson);
                                } catch (_) {
                                    args = {};
                                }
                            }
                            const toolResult = await toolExecutor.execute(args);
                            messages.push({ role: "tool", content: JSON.stringify(toolResult), tool_call_id: toolCall.id });
                        }
                    }
                }
                // Reached max tool calls; force model to produce an answer without further tool use
                const finalResponse = await SELF.chatClient.chat.completions.create({
                    model: SELF.chatModel,
                    messages: messages,
                    tool_choice: 'none',
                })
                return SELF.removeThinkBlock(finalResponse.choices[0].message?.content || '');
            }
            const response = await SELF.chatClient.chat.completions.create({
                model: SELF.chatModel,
                messages: messages,
                tools: tools,
                tool_choice: 'none',
            })
            return SELF.removeThinkBlock(response.choices[0].message?.content || '');
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
                logger.error(error);
            }
        }
    }
}


module.exports = LmService();