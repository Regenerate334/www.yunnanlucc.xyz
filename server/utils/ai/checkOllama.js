/**
 * 通用业务工具类 (General Business Utility)
 * 职责：提供系统级的抽象辅助功能，封装 checkOllama 相关的底层操作逻辑。
 *
 * 修改提示：
 * 1. 本文件为系统底层运行机制的组成部分，修改前请仔细核对依赖关系。
 * 2. 若涉及异步操作，请务必处理 Promise 的 catch 块防止未捕获异常。
 * 3. 遵循现有的 ESLint 和团队代码规范，保持极简及高可读性。
 */
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
            logger.warn('[AI] 警告: Ollama服务未运行! 请手动启动Ollama以启用AI功能。');
            logger.warn(`[AI] Ollama服务连接至 ${OLLAMA_URL} 失败，AI 功能将不可用。`);
            resolve(false);
        });

        req.end();
    });
}
