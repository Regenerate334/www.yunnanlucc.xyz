import http from 'http';
import logger from '../../config/logger.js';

/**
 * 检查 Ollama 服务是否运行，并输出警告
 */
export async function checkOllamaStatus() {
    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

    return new Promise((resolve) => {
        const req = http.get(`${OLLAMA_URL}/api/tags`, (res) => {
            if (res.statusCode === 200) {
                logger.info(`[AI] ✓ Ollama 服务已连接 (${OLLAMA_URL})`);
                resolve(true);
            } else {
                resolve(false);
            }
        });

        req.on('error', () => {
            logger.warn('╔════════════════════════════════════════════════════╗');
            logger.warn('║  警告: Ollama 服务未运行!                           ║');
            logger.warn('║  请手动启动 Ollama (点击桌面图标) 以启用 AI 功能。  ║');
            logger.warn('╚════════════════════════════════════════════════════╝');
            logger.warn(`[AI] Ollama 服务连接至 ${OLLAMA_URL} 失败，AI 功能将不可用。`);
            resolve(false);
        });

        req.end();
    });
}
