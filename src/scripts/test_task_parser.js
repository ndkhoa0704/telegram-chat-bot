const LmService = require('../services/lmService');
const prompts = require('../prompts');

async function test() {
    console.log("Checking environment...");
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    const useLocal = process.env.USE_LOCAL_AI;
    console.log(`OPENAI_API_KEY present: ${hasApiKey}`);
    console.log(`USE_LOCAL_AI: ${useLocal}`);

    console.log("Checking prompts...");
    if (prompts.task_parser) {
        console.log("prompts.task_parser loaded (" + prompts.task_parser.length + " chars)");
    } else {
        console.error("ERROR: prompts.task_parser is MISSING");
    }

    console.log("Initializing LmService...");
    try {
        LmService.init();
    } catch (e) {
        console.error("Error initializing LmService:", e);
    }

    const userRequest = "Every morning at 8am remind me to drink water";
    console.log(`Testing with request: "${userRequest}"`);

    const prompt = `
        ${prompts.task_parser}
        
        User Input: "${userRequest}"
    `;

    console.log("Sending request to AI...");
    try {
        const response = await LmService.getResponse(prompt, false);
        console.log("Raw Response from AI:", response);

        if (!response) {
            console.error("Response is empty (undefined). Check logs for LmService errors.");
            return;
        }

        const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        console.log("\nParsed JSON:");
        console.log(parsed);

        if (parsed.cron && parsed.prompt) {
            console.log("\nSUCCESS: Valid cron and prompt extracted.");
        } else {
            console.log("\nFAILURE: Missing cron or prompt.");
        }
    } catch (e) {
        console.error("\nFAILURE Exception:", e);
    }
}

test();
