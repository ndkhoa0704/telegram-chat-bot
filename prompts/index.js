const fs = require('node:fs');

const promptFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.md'));
const promptsMap = {}
for (const file of promptFiles) {
    promptsMap[file.split('.')[0]] = fs.readFileSync(`${__dirname}/${file}`, 'utf8');
}

module.exports = promptsMap;