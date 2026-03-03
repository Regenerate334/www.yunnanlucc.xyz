/**
 * AI 聊天路由
 * 端点：/chat, /analyze-stream, /suggestions
 */
import express from 'express';
import ollama from 'ollama';
import { DataRouter } from '../../utils/dataRouter.js';

const router = express.Router();
const dataRouter = new DataRouter();

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:20b';

const SYSTEM_PROMPT = `# CRITICAL: Data Authenticity Constraint (最高优先级)
**你只能使用"数据背景"章节中通过API传入的真实数据库数据进行分析。**
- 严禁编造、推测、臆想任何数值、年份或统计结果。
- 如果用户询问的数据不在提供的上下文中，必须明确告知"当前数据背景未包含该信息"。
- 所有引用的数字必须能在"数据背景"表格中找到对应来源。

---

# Role Definition
你是由"云南省国土空间规划系统"搭载的首席GIS数据分析师与生态规划专家。你的核心职责是基于用户提供的地理统计数据，进行专业的土地利用/覆盖变化（LUCC）分析、生态敏感性评估及空间规划建议。

# Knowledge Base & Context
1. **地理背景**: 云南省地处中国西南，地势西北高东南低，地形以山地高原为主，生态环境脆弱且多样。
2. **数据标准**: 数据基于 CLCD (China Land Cover Dataset) 分类体系。

# Output Constraints
1. **拒绝罗列**: 直接输出比率、变化率、趋势判断。
2. **数据严谨**: 引用数据必须精准，必须使用 **km²** 作为单位，保留两位小数。严禁编造数据。
3. **格式规范**: 使用 Markdown，关键结论使用 **加粗**，数据对比使用表格。
4. 结尾必须包含"**决策建议**"。`;

const SIMPLE_SYSTEM_PROMPT = `# 角色：GIS数据分析师
你必须基于提供的【数据背景】回答问题。
# 核心规则
1. **绝对真实**：只能使用提供的数据，严禁编造。
2. **完整性**：列出表格中存在的**全部地类**。
3. **格式**：使用 Markdown 表格展示数据。`;

/**
 * 处理 AI 流式响应
 */
async function handleAIStream(req, res) {
    const { year, messages, question, componentContext, model } = req.body;
    const selectedModel = model || OLLAMA_MODEL;
    let history = messages || (question ? [{ role: 'user', content: question }] : []);

    if (history.length === 0) {
        return res.status(400).json({ error: '请提供问题' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        const lastUserMsg = history.filter(m => m.role === 'user').pop()?.content || '';
        console.log(`[AI/Chat] 收到分析请求，模型: ${selectedModel}`);

        const richContext = await dataRouter.route(lastUserMsg, componentContext, year || 2023);
        const isSmallModel = selectedModel.includes('1.5b') || selectedModel.includes('4b');
        const currentSystemPrompt = isSmallModel ? SIMPLE_SYSTEM_PROMPT : SYSTEM_PROMPT;

        const fullMessages = [{ role: 'system', content: currentSystemPrompt }];
        if (richContext) {
            fullMessages.push({ role: 'system', content: `数据背景：\n${richContext}` });
        }
        fullMessages.push(...history);

        const response = await ollama.chat({
            model: selectedModel,
            messages: fullMessages,
            stream: true,
            keep_alive: 0,
            options: { temperature: 0.6, num_ctx: 8192, top_p: 0.9 }
        });

        for await (const part of response) {
            if (part.message?.content) {
                res.write(`data: ${JSON.stringify({ content: part.message.content })}\n\n`);
            }
            if (part.done) {
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            }
        }

        res.end();
        console.log(`[AI/Chat] 分析完成`);
    } catch (err) {
        console.error('[AI/Chat] 错误:', err);
        if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        }
    }
}

// 路由定义
router.post('/analyze-stream', handleAIStream);
router.post('/', handleAIStream);

router.get('/suggestions', (req, res) => {
    res.json({
        success: true,
        suggestions: [
            '分析云南省近40年的耕地变化趋势',
            '对比昆明和曲靖的建设用地占比',
            '查看2023年各地级市的林地排名',
            '分析滇中地区的土地利用结构特点'
        ]
    });
});

export default router;
