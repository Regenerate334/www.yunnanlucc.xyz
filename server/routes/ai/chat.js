import express from 'express';
import ollama from 'ollama';
import fs from 'fs';
import path from 'path';
import { body, validationResult } from 'express-validator';
import aiMiddleware from '../../utils/aiMiddleware.js';
const router = express.Router();
const DEBUG_LOG = path.join(process.cwd(), 'server', 'logs', 'ollama_debug.log');

// 确保目录存在
if (!fs.existsSync(path.dirname(DEBUG_LOG))) {
    fs.mkdirSync(path.dirname(DEBUG_LOG), { recursive: true });
}

// 动态获取配置
const getDefaultModel = () => process.env.OLLAMA_MODEL || 'gpt-oss:120b-cloud';

async function handleAIStream(req, res) {
    const { year, messages, question, componentContext, model, think } = req.body;
    const isThinkingEnabled = think !== false;
    const selectedModel = model || getDefaultModel();
    let history = messages || (question ? [{ role: 'user', content: question }] : []);

    if (history.length === 0) return res.status(400).json({ error: '请提供问题' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        const lastUserMsg = history.filter(m => m.role === 'user').pop()?.content || '';

        // ── 统一安全校验（通过中间层）──
        const validation = aiMiddleware.validateInput(lastUserMsg);
        if (!validation.safe) return res.status(403).json({ error: validation.reason });
        if (validation.offTopic) {
            const cannedResponse = "抱歉，我是专注于【云南省土地利用变化 (LUCC)】的分析助手，仅回答相关领域问题。";
            res.write(`data: ${JSON.stringify({ content: cannedResponse })}\n\n`);
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            return res.end();
        }

        const shouldPassThinkParam = isThinkingEnabled && aiMiddleware.supportsThinking(selectedModel);
        const keepAlive = setInterval(() => { if (!res.writableEnded) res.write(': keep-alive\n\n'); }, 3000);

        // ── 通过中间层获取数据上下文 ──
        let richContext = '';
        try {
            res.write(`data: ${JSON.stringify({ content: '[SEARCH] 正在智能检索数据背景...' })}\n\n`);
            richContext = await aiMiddleware.getDataContext(lastUserMsg, componentContext, year || 2023);
            if (richContext) res.write(`data: ${JSON.stringify({ content: '\n\n[ANALYSIS] 已获取数据，正在分析...\n\n' })}\n\n`);
        } catch (routeErr) {
            richContext = `> 数据预加载失败: ${routeErr.message}`;
        } finally {
            clearInterval(keepAlive);
        }

        // ── 通过中间层构建系统提示词 ──
        const ctxWindow = aiMiddleware.getContextWindow(selectedModel);
        const currentSystemPrompt = aiMiddleware.buildSystemPrompt({ model: selectedModel, thinking: isThinkingEnabled });
        const fullMessages = [{ role: 'system', content: currentSystemPrompt }];
        if (richContext) fullMessages.push({ role: 'system', content: `数据背景：\n${richContext}` });
        fullMessages.push(...history);

        await callOllamaStream(selectedModel, fullMessages, res, ctxWindow, shouldPassThinkParam);
        res.end();
    } catch (err) {
        if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: formatOllamaError(err) })}\n\n`);
            res.end();
        }
    }
}

async function callOllamaStream(model, messages, res, ctxWindow, thinkEnabled) {
    try {
        const response = await ollama.chat({
            model, messages, stream: true, keep_alive: '5m', think: thinkEnabled,
            options: {
                temperature: 0.6,
                num_ctx: ctxWindow,
                top_p: 0.9,
                repeat_penalty: 1.2,
                presence_penalty: 0.1,
                frequency_penalty: 1.0
            }
        });
        for await (const part of response) {
            const thinking = part.message?.thinking || part.reasoning_content || '';
            if (thinking) res.write(`data: ${JSON.stringify({ thinking })}\n\n`);
            if (part.message?.content) res.write(`data: ${JSON.stringify({ content: part.message.content })}\n\n`);
            if (part.done) res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        }
    } catch (err) { throw err; }
}

function formatOllamaError(err) {
    const msg = err?.message || String(err);
    if (msg.includes('503')) return '模型繁忙（加载中），请稍候。';
    return `AI 异常: ${msg.slice(0, 50)}`;
}

// ── 路由定义 ──────────────────────────────────────────────────────────────────
router.post('/analyze-stream', [
    body('year').optional().isInt({ min: 1985, max: 2100 }),
    body('messages').isArray().withMessage('Messages 必须是数组')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    handleAIStream(req, res);
});

router.post('/refresh-schema', (req, res) => res.json({ success: true }));
export default router;
