/**
 * AI 会话管理路由 (AI Session Management Routes)
 * 职责：负责用户的智能体对话会话创建、历史记录查询以及上下文清理。
 *
 * 修改提示：
 * 1. 会话数据持久化关联当前用户的 Token，严禁跨用户越权读取。
 * 2. 为了防止数据库过载，历史记录查询通常需加上 `limit` 限制。
 * 3. 当用户清空对话时，不仅仅是软删除，通常需清理内存中的代理缓存上下文。
 */
/**
 * 对话会话管理路由
 * 端点：/sessions
 */
import express from 'express';
import pool from '../../config/db.js';
import logger from '../../config/logger.js';
import { authMiddleware } from '../../middleware/auth.js';
import { Ollama } from 'ollama';
import { generateDeepSeekText, isDeepSeekOfficialModel, resolveDeepSeekModel } from '../../utils/ai/core/deepseekClient.js';

const router = express.Router();
const ollama = new Ollama({ host: process.env.OLLAMA_URL || 'http://127.0.0.1:11434' });

const TRACE_SENSITIVE_KEY_RE = /(?:api[_-]?key|token|password|passwd|secret|authorization|cookie|session[_-]?id|private[_-]?key|database[_-]?url)/i;
const TRACE_STORAGE_MAX_DEPTH = 6;
const TRACE_STORAGE_MAX_ARRAY_ITEMS = 24;
const TRACE_STORAGE_MAX_OBJECT_KEYS = 48;

const redactTraceText = (value = '') => String(value || '')
    .replace(/(bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
    .replace(/(postgres(?:ql)?:\/\/[^:\s/@]+:)[^@\s/]+@/gi, '$1[REDACTED]@')
    .replace(/((?:api[_-]?key|token|password|passwd|secret|authorization|cookie|database[_-]?url)\s*[:=]\s*)[^,;\s"']+/gi, '$1[REDACTED]');

const sanitizeTraceStorageValue = (value, depth = 0, maxStringChars = 1200) => {
    if (depth > TRACE_STORAGE_MAX_DEPTH) return '[DEPTH_LIMIT]';
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
        const safe = redactTraceText(value);
        return safe.length > maxStringChars ? `${safe.slice(0, maxStringChars)}\n...[TRUNCATED]` : safe;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) {
        const visible = value.slice(0, TRACE_STORAGE_MAX_ARRAY_ITEMS)
            .map((item) => sanitizeTraceStorageValue(item, depth + 1, maxStringChars));
        if (value.length > TRACE_STORAGE_MAX_ARRAY_ITEMS) {
            visible.push(`[...OMITTED ${value.length - TRACE_STORAGE_MAX_ARRAY_ITEMS} ITEMS]`);
        }
        return visible;
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value);
        const safe = {};
        entries.slice(0, TRACE_STORAGE_MAX_OBJECT_KEYS).forEach(([key, item]) => {
            safe[key] = TRACE_SENSITIVE_KEY_RE.test(key)
                ? '[REDACTED]'
                : sanitizeTraceStorageValue(item, depth + 1, maxStringChars);
        });
        if (entries.length > TRACE_STORAGE_MAX_OBJECT_KEYS) {
            safe.__truncated_keys__ = entries.length - TRACE_STORAGE_MAX_OBJECT_KEYS;
        }
        return safe;
    }
    return redactTraceText(String(value));
};

const truncateTraceText = (value, maxChars) => {
    const text = redactTraceText(value);
    return text.length > maxChars ? `${text.slice(0, maxChars)}\n...[TRUNCATED]` : text;
};

const normalizeTraceForStorage = (trace) => {
    if (!Array.isArray(trace)) return [];
    const nodes = trace.slice(-80);
    const reasoningNodeCount = Math.max(1, nodes.filter((node) => node?.reasoning).length);
    const observationNodeCount = Math.max(1, nodes.filter((node) => node?.observation?.preview).length);
    const reasoningPerNodeLimit = Math.max(512, Math.min(6000, Math.floor(48000 / reasoningNodeCount)));
    const observationPerNodeLimit = Math.max(1000, Math.min(12000, Math.floor(72000 / observationNodeCount)));

    return nodes.map((node, index) => {
        const rawObservationPreview = String(node?.observation?.preview || '');
        const observation = node?.observation && typeof node.observation === 'object'
            ? {
                summary: truncateTraceText(node.observation.summary, 600),
                preview: truncateTraceText(rawObservationPreview, observationPerNodeLimit),
                format: node.observation.format === 'json' ? 'json' : 'text',
                truncated: Boolean(node.observation.truncated) || rawObservationPreview.length > observationPerNodeLimit,
                original_chars: Math.max(0, Number(node.observation.original_chars) || 0)
            }
            : undefined;
        return {
            id: truncateTraceText(node?.id || `trace_${index}`, 160),
            phase: truncateTraceText(node?.phase || 'system', 40),
            status: ['running', 'completed', 'error'].includes(node?.status) ? node.status : 'completed',
            title: truncateTraceText(node?.title || 'Agent 执行阶段', 180),
            summary: truncateTraceText(node?.summary, 1200),
            detail: truncateTraceText(node?.detail, 2400),
            parameters: node?.parameters && typeof node.parameters === 'object'
                ? sanitizeTraceStorageValue(node.parameters)
                : undefined,
            tool: truncateTraceText(node?.tool, 120),
            source: truncateTraceText(node?.source, 120),
            scope_source: ['question', 'tool', 'question+tool'].includes(node?.scope_source)
                ? node.scope_source
                : undefined,
            round: Number.isFinite(Number(node?.round)) ? Number(node.round) : undefined,
            duration_ms: Math.max(0, Number(node?.duration_ms) || 0),
            observation,
            reasoning: truncateTraceText(node?.reasoning, reasoningPerNodeLimit),
            error: truncateTraceText(node?.error, 1200),
            timestamp: truncateTraceText(node?.timestamp, 64)
        };
    });
};

/**
 * 使用 AI 生成简洁的对话标题（异步执行）
 */
async function generateSessionTitle(sessionId, userMessage) {
    try {
        const desiredModel = process.env.REPORT_MODEL || process.env.CHAT_MODEL || process.env.OLLAMA_MODEL || 'deepseek-v4-pro';
        const titlePrompt = '你是一个专业的对话标题提取器。请根据用户的问题，提取一个4-8个字的极简中文标题。只输出标题文字，严禁包含"标题："、引号、标点或任何解释。';

        let title = '';
        if (isDeepSeekOfficialModel(desiredModel)) {
            const content = await generateDeepSeekText(
                [
                    { role: 'system', content: titlePrompt },
                    { role: 'user', content: userMessage }
                ],
                {
                    model: resolveDeepSeekModel(desiredModel),
                    temperature: 0.2,
                    topP: 0.9
                }
            );
            title = String(content || '').trim();
        } else {
            const response = await ollama.chat({
                model: desiredModel || 'deepseek-r1:8b',
                messages: [
                    { role: 'system', content: titlePrompt },
                    { role: 'user', content: userMessage }
                ],
                options: { temperature: 0.3, num_ctx: 512 }
            });
            title = response.message?.content?.trim() || '';
        }

        title = title.slice(0, 30) || userMessage.slice(0, 20);
        await pool.query('UPDATE chat_sessions SET title = $1 WHERE id = $2', [title, sessionId]);
        logger.info(`[Sessions] AI 生成标题: "${title}"`);
    } catch (err) {
        logger.error('[Sessions] AI 生成标题失败:', { message: err?.message || String(err) });
        const fallbackTitle = userMessage.length > 20 ? userMessage.slice(0, 17) + '...' : userMessage;
        await pool.query('UPDATE chat_sessions SET title = $1 WHERE id = $2', [fallbackTitle, sessionId]).catch(() => { });
    }
}

// 获取当前用户的所有会话
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, title, created_at, updated_at FROM chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC',
            [req.user.id]
        );
        res.json({ success: true, sessions: rows });
    } catch (err) {
        logger.error('[Sessions] 获取失败:', { message: err?.message || String(err) });
        res.status(500).json({ error: '获取会话列表失败' });
    }
});

// 创建新会话
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title = '新对话' } = req.body;
        const { rows } = await pool.query(
            'INSERT INTO chat_sessions (user_id, title, messages) VALUES ($1, $2, $3) RETURNING id, title',
            [req.user.id, title, JSON.stringify([])]
        );
        res.json({ success: true, session: rows[0] });
    } catch (err) {
        logger.error('[Sessions] 创建失败:', { message: err?.message || String(err) });
        res.status(500).json({ error: '创建会话失败' });
    }
});

// 获取会话的所有消息
router.get('/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT messages FROM chat_sessions WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(403).json({ error: '无权访问该会话' });
        }
        res.json({ success: true, messages: rows[0].messages || [] });
    } catch (err) {
        logger.error('[Sessions] 获取消息失败:', { message: err?.message || String(err) });
        res.status(500).json({ error: '获取消息失败' });
    }
});

// 保存消息并更新会话
router.post('/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { role, content, thinking, thinkTime, workflow, trace } = req.body;
        const { rows } = await pool.query(
            'SELECT messages, title FROM chat_sessions WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (rows.length === 0) {
            return res.status(403).json({ error: '无权访问该会话' });
        }

        let messages = rows[0].messages || [];
        let title = rows[0].title;
        const isFirstUserMessage = role === 'user' && (title === '新对话' || !title);

        // 构建增强版消息对象
        const normalizedTrace = normalizeTraceForStorage(trace);
        const messageObj = {
            role,
            content,
            // 新版 Trace 已按阶段保存 reasoning，避免再存一份重复的完整 thinking。
            thinking: normalizedTrace.length ? '' : truncateTraceText(thinking, 48000),
            thinkTime: thinkTime || 0,
            workflow: Array.isArray(workflow) ? workflow : [],
            trace: normalizedTrace,
            created_at: new Date().toISOString()
        };
        messages.push(messageObj);

        if (isFirstUserMessage) {
            title = content.length > 20 ? content.substring(0, 17) + '...' : content;
        }

        await pool.query(
            'UPDATE chat_sessions SET messages = $1, title = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [JSON.stringify(messages), title, req.params.id]
        );

        if (isFirstUserMessage) {
            generateSessionTitle(req.params.id, content).catch(() => { });
        }

        res.json({ success: true });
    } catch (err) {
        logger.error('[Sessions] 保存失败:', { message: err?.message || String(err) });
        res.status(500).json({ error: '保存消息失败' });
    }
});

// 删除会话
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: '会话不存在或无权删除' });
        }
        res.json({ success: true });
    } catch (err) {
        logger.error('[Sessions] 删除失败:', { message: err?.message || String(err) });
        res.status(500).json({ error: '删除会话失败' });
    }
});

export default router;
