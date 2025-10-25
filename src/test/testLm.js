require('dotenv').config();
const LmService = require('../services/lmService');

async function test() {
    LmService.init();
    const response = await LmService.getResponse(`
        What are today's most important and widely-discussed news stories in Vietnam? 
        Focus on: 
        1) Breaking news and major developments 
        2) Viral stories getting significant attention 
        3) Notable events affecting many people 
        4) Surprising or unusual stories gaining traction
    `);
    console.log(response);
}

test();