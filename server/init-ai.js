import { spawn } from 'child_process';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config({ path: './server/.env' });

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:20b';


/**
 * 检查 Ollama 服务是否运行
 */
function checkOllama() {
    return new Promise((resolve) => {
        http.get(`${OLLAMA_URL}/api/tags`, (res) => {
            resolve(res.statusCode === 200);
        }).on('error', () => {
            resolve(false);
        });
    });
}

/**
 * 检查模型是否已下载
 */
async function checkModel(modelName) {
    try {
        const res = await fetch(`${OLLAMA_URL}/api/tags`);
        const data = await res.json();
        return data.models.some(m => m.name.startsWith(modelName));
    } catch (err) {
        return false;
    }
}

/**
 * 提示手动启动 Ollama 服务
 */
function promptOllamaStart() {
    console.log('\x1b[33m╔════════════════════════════════════════════════════╗\x1b[0m');
    console.log('\x1b[33m║  Ollama 未运行，请手动启动 Ollama 后再继续       ║\x1b[0m');
    console.log('\x1b[33m╚════════════════════════════════════════════════════╝\x1b[0m');
    console.log('\x1b[36m提示:\x1b[0m');
    console.log('  1. 通常，npm run dev 会自动拉起 Ollama 服务。');
    console.log('  2. 如果您看到此消息，说明端口有冲突或尚未拉起。');
    console.log('  3. 您可以直接点击桌面上的 Ollama 图标手动启动它。');
    console.log('');
}

/**
 * 自动拉取模型
 */
function pullModel(modelName) {
    console.log(`\x1b[33m[AI] 正在拉取大模型 ${modelName}，这可能需要一些时间...\x1b[0m`);
    const pull = spawn('ollama', ['pull', modelName], { stdio: 'inherit', shell: true });

    pull.on('close', (code) => {
        if (code === 0) {
            console.log(`\x1b[32m[AI] 模型 ${modelName} 准备就绪！\x1b[0m`);
        } else {
            console.error(`\x1b[31m[AI] 拉取模型失败，退出码: ${code}\x1b[0m`);
        }
    });
}

async function initAI() {
    console.log('\x1b[36m[AI] 正在检查 Ollama 服务...\x1b[0m');

    const isRunning = await checkOllama();

    if (!isRunning) {
        console.error('\x1b[31m[AI] Ollama 服务未运行\x1b[0m');
        promptOllamaStart();
    } else {
        console.log('\x1b[32m[AI] ✓ Ollama 服务已连接\x1b[0m');
        const hasModel = await checkModel(DEFAULT_MODEL);
        if (!hasModel) {
            console.log(`\x1b[33m[AI] 模型 ${DEFAULT_MODEL} 未找到，将在后台拉取\x1b[0m`);
            pullModel(DEFAULT_MODEL);
            // 不等待模型下载完成，让服务器继续启动
        } else {
            console.log(`\x1b[32m[AI] ✓ 大模型 ${DEFAULT_MODEL} 已就绪\x1b[0m`);
        }
    }
}

// 使用 IIFE 确保脚本等待异步操作完成
(async () => {
    await initAI();
    process.exit(0);
})();
