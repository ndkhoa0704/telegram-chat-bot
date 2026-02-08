import { OpenRouter } from '@openrouter/sdk';
import prompts from '../prompts/index.js';
import tools from '../tools/index.js';
import logger from '../utils/log.util.js';


function LmService() {
    const SELF = {
        chatClient: null,
        chatModel: null,
        removeThinkBlock: (text) => {
            if (!text.includes('</think>')) return text;
            const parts = text.split('</think>')
            return parts[parts.length - 1]
        },
        FILES_FOLDER_PATH: process.env.FILES_FOLDER_PATH,
        MAX_TOOL_CALLS: 3
    }
    return {
        init: () => {
            SELF.chatClient = new OpenRouter({
                apiKey: process.env.OPENROUTER_API_KEY,
            })
            SELF.chatModel = process.env.CHAT_MODEL
            logger.info(`${SELF.chatModel} initialized`);
        },
        getResponse: async (message, toolUse = true) => {
            try {
                const messages = [
                    { role: "system", content: prompts.perplexity },
                    { role: "user", content: message },
                ];
                if (toolUse) {
                    for (let i = 0; i < SELF.MAX_TOOL_CALLS; i++) {
                        const response = await SELF.chatClient.chat.send({
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
                    const finalResponse = await SELF.chatClient.chat.send({
                        model: SELF.chatModel,
                        messages: messages,
                        tool_choice: 'none',
                    })
                    return SELF.removeThinkBlock(finalResponse.choices[0].message?.content || '');
                }
                const response = await SELF.chatClient.chat.send({
                    model: SELF.chatModel,
                    messages: messages,
                    tools: tools,
                    tool_choice: 'none',
                })
                return SELF.removeThinkBlock(response.choices[0].message?.content || '');
            } catch (error) {
                logger.error(`LmService.getResponse - error ${error.stack}`)
            }
        },
    }
}


export default LmService();