/**
 * 对话会话管理路由
 * 端点：/sessions
 */
import express from 'express';
import pool from '../../config/db.js';
import { authMiddleware } from '../../middleware/auth.js';
import { Ollama } from 'ollama';

const router = express.Router();
const ollama = new Ollama({ host: process.env.OLLAMA_URL || 'http://127.0.0.1:11434' });

/**
 * 使用 AI 生成简洁的对话标题（异步执行）
 */
async function generateSessionTitle(sessionId, userMessage) {
    try {
        const response = await ollama.chat({
            model: process.env.OLLAMA_MODEL || 'deepseek-r1:8b',
            messages: [
                {
                    role: 'system',
                    content: '你是一个专业的对话标题提取器。请根据用户的问题，提取一个4-8个字的极简中文标题。只输出标题文字，严禁包含"标题："、引号、标点或任何解释。'
                },
                { role: 'user', content: userMessage }
            ],
            options: { temperature: 0.3, num_ctx: 512 }
        });

        const title = response.message?.content?.trim().slice(0, 30) || userMessage.slice(0, 20);
        await pool.query('UPDATE chat_sessions SET title = $1 WHERE id = $2', [title, sessionId]);
        console.log(`[Sessions] AI 生成标题: "${title}"`);
    } catch (err) {
        console.error('[Sessions] AI 生成标题失败:', err.message);
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
        console.error('[Sessions] 获取失败:', err);
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
        console.error('[Sessions] 创建失败:', err);
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
        console.error('[Sessions] 获取消息失败:', err);
        res.status(500).json({ error: '获取消息失败' });
    }
});

// 保存消息并更新会话
router.post('/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { role, content } = req.body;
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

        messages.push({ role, content, created_at: new Date().toISOString() });

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
        console.error('[Sessions] 保存失败:', err);
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
        console.error('[Sessions] 删除失败:', err);
        res.status(500).json({ error: '删除会话失败' });
    }
});

export default router;
