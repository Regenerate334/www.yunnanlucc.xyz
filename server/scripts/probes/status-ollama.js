import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('[AI Check Warning] Failed to load .env file from:', envPath);
}

async function check() {
    // 兼容多种环境变量命名
    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

    const req = http.get(`${OLLAMA_URL}/api/tags`, (res) => {
        if (res.statusCode === 200) {
            res.resume();
        } else {
            console.error(`[AI Check Failed] ${OLLAMA_URL} returned status: ${res.statusCode}`);
            process.exit(1);
        }
    });
    req.on('error', (err) => {
        console.error(`[AI Check Error] ${OLLAMA_URL}:`, err.message);
        process.exit(1);
    });
    req.setTimeout(5000, () => {
        console.error(`[AI Check Timeout] ${OLLAMA_URL} connection timed out`);
        req.destroy();
        process.exit(1);
    });
}

check();
setInterval(check, 30000);
