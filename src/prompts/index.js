import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const promptFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.md'));
const promptsMap = {}
for (const file of promptFiles) {
    promptsMap[file.split('.')[0]] = fs.readFileSync(`${__dirname}/${file}`, 'utf8');
}

export default promptsMap;