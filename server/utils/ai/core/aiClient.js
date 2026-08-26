/**
 * 通用业务工具类 (General Business Utility)
 * 职责：提供系统级的抽象辅助功能，封装 aiClient 相关的底层操作逻辑。
 *
 * 修改提示：
 * 1. 本文件为系统底层运行机制的组成部分，修改前请仔细核对依赖关系。
 * 2. 若涉及异步操作，请务必处理 Promise 的 catch 块防止未捕获异常。
 * 3. 遵循现有的 ESLint 和团队代码规范，保持极简及高可读性。
 */
/**
 * aiClient.js — 统一 AI 调用客户端
 *
 * 封装 AI 调用，对外提供两种模式：
 *  - generateJSON()  非流式，用于报告生成（需要严格 JSON 输出）
 *  - streamChat()    流式 SSE，用于对话（现有 chat.js 的能力，此处仅作接口声明）
 *
 * 模型选择策略：
 *  - REPORT_MODEL  用于报告生成，默认走 DeepSeek 官方云端模型
 *  - CHAT_MODEL    用于日常对话，未设置时兼容读取 OLLAMA_MODEL
 */

import ollama from 'ollama';
import logger from '../../../config/logger.js';
import { generateDeepSeekText, isDeepSeekOfficialModel } from './deepseekClient.js';

/**
 * 动态获取模型配置，确保在 dotenv 加载后读取最新值
 */
export const getReportModel = () => process.env.REPORT_MODEL || process.env.CHAT_MODEL || process.env.OLLAMA_MODEL || 'deepseek-v4-pro';
export const getChatModel = () => process.env.CHAT_MODEL || process.env.OLLAMA_MODEL || 'deepseek-v4-pro';

/**
 * 非流式调用：让模型输出纯 JSON。
 * 包含自动重试与 JSON 修复逻辑（借鉴 PedroReports CodeFixer 模式）。
 *
 * @param {Array}  messages   - Ollama messages 数组 [{role, content}]
 * @param {Object} [opts]
 * @param {string} [opts.model]       - 指定模型，默认从 getReportModel() 获取
 * @param {number} [opts.maxRetries]  - 最大重试次数，默认 3
 * @param {number} [opts.numCtx]      - 上下文窗口，默认 16384
 * @returns {Promise<string>} AI 返回的原始文本
 */
export async function generateText(messages, opts = {}) {
    const model = opts.model || getReportModel();
    const maxRetries = opts.maxRetries || 3;
    const numCtx = opts.numCtx || 16384;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            logger.info(`[aiClient] generateText 第 ${attempt} 次调用，模型: ${model}`);

            if (isDeepSeekOfficialModel(model)) {
                const content = await generateDeepSeekText(messages, {
                    model,
                    temperature: 0.2,
                    topP: 0.9,
                    ...(Number.isFinite(Number(opts.maxTokens)) && Number(opts.maxTokens) > 0
                        ? { maxTokens: Number(opts.maxTokens) }
                        : {})
                });
                logger.info(`[aiClient] DeepSeek 调用成功，输出长度: ${content.length}`);
                return content;
            }

            const response = await ollama.chat({
                model,
                messages,
                stream: false,
                keep_alive: '5m',
                options: {
                    temperature: 0.2,   // 进一步降低随机性，保证 JSON 稳健
                    num_ctx: numCtx,
                    top_p: 0.9,
                    num_gpu: -1          // 强制使用 GPU 加速
                }
            });

            const content = response.message?.content || '';
            logger.info(`[aiClient] 调用成功，输出长度: ${content.length}`);
            return content;

        } catch (err) {
            lastError = err;
            const isConnError = err?.name === 'FetchError' || err?.message?.includes('fetch failed') || err?.status === 503;

            if (isConnError && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
                logger.warn(`[aiClient] 连接异常 (Attempt ${attempt}), ${delay}ms 后指数退避重试: ${err.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            logger.error(`[aiClient] 第 ${attempt} 次调用失败: ${err.message}`);
            if (attempt >= maxRetries) throw err;
        }
    }

    throw lastError || new Error('aiClient.generateText: 超过最大重试次数');
}

/**
 * 从 AI 返回的原始文本中提取 JSON 对象。
 * 处理 AI 常见的格式问题：代码块标记、前后多余文字。
 *
 * @param {string} rawText
 * @returns {Object} 解析后的 JSON 对象
 * @throws {Error} 无法解析时抛出，附带原始内容用于调试
 */
export function extractJSON(rawText) {
    if (!rawText) throw new Error('AI 返回内容为空');

    // 1. 去除 ```json ... ``` 或 ``` ... ``` 包裹
    let cleaned = rawText
        .replace(/^```(?:json)?\s*/im, '')
        .replace(/\s*```\s*$/im, '')
        .trim();

    // 2. 尝试直接解析
    try {
        return JSON.parse(cleaned);
    } catch (_) {
        // 3. 提取第一个 { ... } 或 [ ... ] 块（AI 可能在 JSON 前后加了解释文字）
        const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch (e2) {
                throw new Error(`JSON 解析失败: ${e2.message}\n原始内容(前500字):\n${rawText.slice(0, 500)}`);
            }
        }
        throw new Error(`未找到 JSON 对象\n原始内容(前500字):\n${rawText.slice(0, 500)}`);
    }
}
