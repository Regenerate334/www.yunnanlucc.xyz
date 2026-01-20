import express from 'express';
import pool from '../config/db.js';
import { handleError } from '../middleware/logger.js';

const router = express.Router();

// ============ 本地 Ollama API 配置 ============
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-r1:8b';

const SYSTEM_PROMPT = `你是云南省土地利用变化(LUCC)分析专家系统。使用 Markdown 表格展示数据，基于提供的上下文进行专业、简洁的中文分析。`;

// 简化版的上下文构建（如果需要更复杂的，可以从 ai.js 导入）
async function buildSimpleContext() {
    return ""; // 简单模式暂不构建上下文
}

/**
 * POST /chat - 直接聊天端点（兼容性）
 * 这个端点是为了兼容可能直接调用 /api/chat 的前端代码
 */
router.post('/', async (req, res) => {
    const { year, messages, question, landData, region, model } = req.body;
    const selectedModel = model || OLLAMA_MODEL;
    let history = messages || (question ? [{ role: 'user', content: question }] : []);

    if (history.length === 0) {
        return res.status(400).json({ error: '请提供问题' });
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history
        ];

        // 调用 Ollama API
        const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: selectedModel,
                messages: fullMessages,
                stream: true,
                options: { temperature: 0.7, num_ctx: 4096 }
            })
        });

        if (!ollamaRes.ok) {
            throw new Error(`Ollama API 错误: ${ollamaRes.status}`);
        }

        const reader = ollamaRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // 流式读取和转发
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保留最后一行（可能不完整）

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);
                    if (json.message?.content) {
                        res.write(`data: ${JSON.stringify({ content: json.message.content })}\n\n`);
                    }
                    if (json.done) {
                        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                    }
                } catch (e) {
                    console.error('[CHAT] 解析 Ollama 响应失败:', e.message);
                }
            }
        }

        // 处理剩余的缓冲区
        if (buffer.trim()) {
            try {
                const json = JSON.parse(buffer);
                if (json.message?.content) {
                    res.write(`data: ${JSON.stringify({ content: json.message.content })}\n\n`);
                }
                if (json.done) {
                    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                }
            } catch (e) {
                // 忽略解析错误
            }
        }

        res.end();
    } catch (err) {
        console.error('[CHAT] 错误:', err.message);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
});

export default router;
