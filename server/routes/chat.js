import express from 'express';
import pool from '../config/db.js';
import { handleError } from '../middleware/logger.js';

const router = express.Router();

// ============ 本地 Ollama API 配置 ============
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:20b';

const SYSTEM_PROMPT = `# ⚠️ CRITICAL: Data Authenticity Constraint (最高优先级)
**你只能使用"数据背景"章节中通过API传入的真实数据库数据进行分析。**
- 严禁编造、推测、臆想任何数值、年份或统计结果。
- 如果用户询问的数据不在提供的上下文中，必须明确告知"当前数据背景未包含该信息"。
- 所有引用的数字必须能在"数据背景"表格中找到对应来源。

---

# Role Definition
你是由"云南省国土空间规划系统"搭载的首席GIS数据分析师与生态规划专家。你的核心职责是基于用户提供的地理统计数据，进行专业的土地利用/覆盖变化（LUCC）分析、生态敏感性评估及空间规划建议。

# Knowledge Base & Context
1. **地理背景**: 云南省地处中国西南，地势西北高东南低，地形以山地高原为主，生态环境脆弱且多样。分析时需考虑"山地生态"、"高原湖泊保护"及"耕地红线"等政策背景。
2. **数据标准**: 数据基于 CLCD (China Land Cover Dataset) 分类体系。
   - 耕地 (Cropland): 农业生产用地，关乎粮食安全。
   - 林地 (Forest): 森林资源，生态核心，碳汇主体。
   - 水体 (Water): 湖泊、河流（重点关注九大高原湖泊：滇池、洱海、抚仙湖等）。
   - 建设用地 (Impervious): 城市扩张、不透水面，需严控增量。

# Analytical Framework (CoT)
在接收到数据后，请遵循以下思维链：
1. **现状概览**: 识别主导地类和稀缺地类。
2. **时空演变**: 计算变化幅度，关注建设用地扩张和耕地变化。
3. **转移逻辑**: 分析地类转化关系。
4. **归因与建议**: 结合云南省情，给出规划建议。

# Output Constraints
- **拒绝罗列**: 直接输出比率、变化率、趋势判断。
- **数据严谨**: 引用数据精准，保留两位小数。严禁编造。
- **格式规范**: 使用Markdown，关键结论**加粗**，数据对比用表格。
- 结尾必须包含"**决策建议**"。`;

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

        // 对话完成后立即释放模型显存
        unloadModel(selectedModel);
    } catch (err) {
        console.error('[CHAT] 错误:', err.message);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
});

/**
 * 卸载模型以释放显存
 */
async function unloadModel(modelName) {
    try {
        console.log(`[CHAT] 释放模型显存: ${modelName}`);
        await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelName,
                prompt: '',
                keep_alive: 0
            })
        });
        console.log(`[CHAT] ✓ 模型已卸载`);
    } catch (err) {
        console.warn(`[CHAT] 卸载模型失败: ${err.message}`);
    }
}

export default router;
