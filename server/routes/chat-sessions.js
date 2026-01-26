import express from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import ollama from 'ollama';

const router = express.Router();

/**
 * 使用 AI 生成简洁的对话标题（异步执行，不阻塞主流程）
 */
async function generateSessionTitle(sessionId, userMessage) {
    try {
        const response = await ollama.chat({
            model: 'gemma3:4b', // 使用快速小模型生成标题
            messages: [
                {
                    role: 'system',
                    content: '你是一个标题生成器。根据用户的问题，生成一个5-15字的简洁中文标题。只输出标题本身，不要任何解释、标点或引号。'
                },
                {
                    role: 'user',
                    content: `为这个问题生成标题：${userMessage}`
                }
            ],
            options: {
                temperature: 0.3,
                num_ctx: 256
            }
        });

        const title = response.message?.content?.trim().slice(0, 30) || userMessage.slice(0, 20);

        // 更新数据库中的标题
        await pool.query(
            'UPDATE chat_sessions SET title = $1 WHERE id = $2',
            [title, sessionId]
        );

        console.log(`[Sessions] AI 生成标题: "${title}" (session: ${sessionId})`);
    } catch (err) {
        console.error('[Sessions] AI 生成标题失败，使用截断标题:', err.message);
        // 失败时使用简单截断作为后备
        const fallbackTitle = userMessage.length > 20 ? userMessage.slice(0, 17) + '...' : userMessage;
        await pool.query(
            'UPDATE chat_sessions SET title = $1 WHERE id = $2',
            [fallbackTitle, sessionId]
        ).catch(() => { });
    }
}

/**
 * GET /api/chat-sessions - 获取当前用户的所有会话
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { rows } = await pool.query(
            'SELECT id, title, created_at, updated_at FROM chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC',
            [userId]
        );
        res.json({ success: true, sessions: rows });
    } catch (err) {
        console.error('[Sessions] 获取失败:', err);
        res.status(500).json({ error: '获取会话列表失败' });
    }
});

/**
 * POST /api/chat-sessions - 创建新会话
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { title = '新对话' } = req.body;
        const { rows } = await pool.query(
            'INSERT INTO chat_sessions (user_id, title, messages) VALUES ($1, $2, $3) RETURNING id, title',
            [userId, title, JSON.stringify([])]
        );
        res.json({ success: true, session: rows[0] });
    } catch (err) {
        console.error('[Sessions] 创建失败:', err);
        res.status(500).json({ error: '创建会话失败' });
    }
});

/**
 * GET /api/chat-sessions/:id/messages - 获取会话的所有消息
 */
router.get('/:id/messages', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = req.params.id;

        const { rows } = await pool.query(
            'SELECT messages FROM chat_sessions WHERE id = $1 AND user_id = $2',
            [sessionId, userId]
        );

        if (rows.length === 0) {
            return res.status(403).json({ error: '无权访问该会话' });
        }

        res.json({ success: true, messages: rows[0].messages || [] });
    } catch (err) {
        console.error('[Messages] 获取失败:', err);
        res.status(500).json({ error: '获取消息失败' });
    }
});

/**
 * POST /api/chat-sessions/:id/messages - 保存消息并更新会话
 */
router.post('/:id/messages', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = req.params.id;
        const { role, content } = req.body;

        // 1. 获取当前消息列表和标题
        const { rows } = await pool.query(
            'SELECT messages, title FROM chat_sessions WHERE id = $1 AND user_id = $2',
            [sessionId, userId]
        );

        if (rows.length === 0) {
            return res.status(403).json({ error: '无权访问该会话' });
        }

        let messages = rows[0].messages || [];
        let title = rows[0].title;
        const isFirstUserMessage = role === 'user' && (title === '新对话' || !title);

        // 2. 追加新消息
        messages.push({ role, content, created_at: new Date().toISOString() });

        // 3. 如果是用户的第一条消息，先设临时标题，稍后异步生成智能标题
        if (isFirstUserMessage) {
            title = content.length > 20 ? content.substring(0, 17) + '...' : content;
        }

        // 4. 更新数据库
        await pool.query(
            'UPDATE chat_sessions SET messages = $1, title = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [JSON.stringify(messages), title, sessionId]
        );

        // 5. 异步生成 AI 标题（不阻塞响应）
        if (isFirstUserMessage) {
            generateSessionTitle(sessionId, content).catch(() => { });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[Messages] 保存失败:', err);
        res.status(500).json({ error: '保存消息失败' });
    }
});

/**
 * DELETE /api/chat-sessions/:id - 删除会话
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = req.params.id;

        const result = await pool.query(
            'DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2',
            [sessionId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '会话不存在或无权删除' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[Sessions] 删除失败:', err);
        res.status(500).json({ error: '删除会话失败' });
    }
});

export default router;
