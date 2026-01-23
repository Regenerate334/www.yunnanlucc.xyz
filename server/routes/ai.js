import express from 'express';
import ollama from 'ollama';
import { DataRouter } from '../utils/dataRouter.js';

const router = express.Router();
const dataRouter = new DataRouter();

// ============ 本地 Ollama 配置 ============
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:20b';

const SYSTEM_PROMPT = `# CRITICAL: Data Authenticity Constraint (最高优先级)
**你只能使用"数据背景"章节中通过API传入的真实数据库数据进行分析。**
- 严禁编造、推测、臆想任何数值、年份或统计结果。
- 如果用户询问的数据不在提供的上下文中，必须明确告知"当前数据背景未包含该信息"，而非编造回答。
- 所有引用的数字必须能在"数据背景"表格中找到对应来源。
- 违反此规则将导致分析结果无效。

---

# Role Definition
你是由"云南省国土空间规划系统"搭载的首席GIS数据分析师与生态规划专家。你的核心职责是基于用户提供的地理统计数据，进行专业的土地利用/覆盖变化（LUCC）分析、生态敏感性评估及空间规划建议。

# Knowledge Base & Context
1. **地理背景**: 云南省地处中国西南，地势西北高东南低，地形以山地高原为主，生态环境脆弱且多样。分析时需考虑"山地生态"、"高原湖泊保护"及"耕地红线"等政策背景。
2. **数据标准**: 数据基于 CLCD (China Land Cover Dataset) 分类体系。
   - 耕地 (Cropland): 农业生产用地，关乎粮食安全。
   - 林地 (Forest): 森林资源，生态核心，碳汇主体。
   - 灌木 (Shrub): 过渡性植被，生态缓冲带。
   - 草地 (Grassland): 畜牧与生态功能兼具。
   - 水体 (Water): 湖泊、河流（重点关注九大高原湖泊：滇池、洱海、抚仙湖等）。
   - 建设用地 (Impervious): 城市扩张、不透水面，需严控增量。
   - 裸地/冰雪 (Barren/Snow): 自然保留地。

# Analytical Framework (CoT)
在接收到数据后，请严格遵循以下思维链进行分析：
1. **现状概览**: 快速识别该区域的主导地类（占比最大）和稀缺地类。
2. **时空演变**: 如果提供多期数据，计算变化幅度。
   - *关注点*: 建设用地是否无序扩张？耕地是否减少？林地是否破碎化？
3. **转移逻辑**: 分析地类之间的转化关系（如：耕地→建设用地=城市化占用；耕地→林地=退耕还林政策）。
4. **归因与建议**: 结合云南省情，给出基于数据的规划建议（如：严控建设用地增量，提升存量用地效率）。

# Output Constraints
1. **拒绝罗列**: 不要把数据翻译成文字再读一遍（用户能看懂图表）。请直接输出**比率、变化率、趋势判断**。
2. **数据严谨**: 引用数据必须精准，必须使用 **km²** 作为单位，保留两位小数并添加千位分隔符（例如：12,345.67 km²）。**严禁**使用“万km²”、“亿km²”等缩略单位。严禁编造数据。
3. **格式规范**: 
   - 使用 Markdown 渲染。
   - 使用 \`###\` 分级标题组织内容。
   - 关键结论使用 **加粗**。
   - 数据对比强烈建议使用 Markdown 表格。
   - 涉及警示性内容（如耕地剧减）使用 \`>\` 引用块强调。

# Style Guide
- 语言风格：学术、客观、精炼（类似《地理学报》或政府规划公报）。
- 避免口语化表达（如"哪怕"、"大概"、"好像"）。
- 结尾必须包含一段"**决策建议**"或"**政策启示**"。`;

const SIMPLE_SYSTEM_PROMPT = `# 角色：GIS数据分析师
你必须基于提供的【数据背景】回答问题。

# 核心规则
1. **绝对真实**：只能使用提供的数据，严禁编造。
2. **完整性**：如果用户询问"各类"或"所有"数据，必须列出表格中存在的**全部9种地类**（耕地、林地、灌木、草地、水体、湿地、建设用地、裸地、冰雪），不可遗漏。
3. **格式**：使用 Markdown 表格展示数据。

# 数据背景说明
数据包含云南省的土地利用面积（单位：km²，已添加千位分隔符）。请务必保持此格式，不要转换为“万”单位。
`;

/**
 * 处理 AI 流式响应 - 使用 Ollama SDK
 */
async function handleAIStream(req, res) {
    const { year, messages, question, componentContext, region, model } = req.body;
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

        console.log('\n' + '='.repeat(60));
        console.log('[AI] 收到分析请求 (Ollama SDK)');
        console.log('='.repeat(60));
        console.log(`[AI] 模型: ${selectedModel}`);
        console.log(`[AI] 区域: ${region || '云南省'}`);
        console.log(`[AI] 年份: ${year || 2023}`);
        console.log(`[AI] 上下文类型: ${componentContext?.type || 'none'}`);
        console.log(`[AI] 用户问题: ${lastUserMsg}`);

        const richContext = await dataRouter.route(lastUserMsg, componentContext, year || 2023);

        // 针对小模型使用简化 Prompt
        const isSmallModel = selectedModel.includes('1.5b') || selectedModel.includes('4b') || selectedModel.includes('gemma');
        const currentSystemPrompt = isSmallModel ? SIMPLE_SYSTEM_PROMPT : SYSTEM_PROMPT;

        const fullMessages = [{ role: 'system', content: currentSystemPrompt }];
        if (richContext) {
            console.log('-'.repeat(60));
            console.log('[AI] 数据上下文:');
            console.log(richContext);
            console.log('-'.repeat(60));
            fullMessages.push({ role: 'system', content: `数据背景：\n${richContext}` });
        }

        fullMessages.push(...history);
        console.log(`[AI] 发送到 Ollama (共 ${fullMessages.length} 条消息)`);

        // 使用 Ollama SDK 流式响应
        const response = await ollama.chat({
            model: selectedModel,
            messages: fullMessages,
            stream: true,
            keep_alive: 0,
            options: {
                temperature: 0.6,
                num_ctx: 8192,
                top_p: 0.9
            }
        });

        // 处理流式响应
        for await (const part of response) {
            if (part.message?.content) {
                res.write(`data: ${JSON.stringify({ content: part.message.content })}\n\n`);
            }
            if (part.done) {
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            }
        }

        res.end();
        console.log(`[AI] 分析完成，响应已发送`);

    } catch (err) {
        console.error('[AI] 错误:', err);
        if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        }
    }
}

// 路由定义
router.post('/analyze-stream', handleAIStream);
router.post('/chat', handleAIStream);

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
