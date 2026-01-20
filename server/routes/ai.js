import express from 'express';
import pool from '../config/db.js';
import { handleError } from '../middleware/logger.js';

const router = express.Router();

// ============ 本地 Ollama API 配置 ============
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-r1:8b';


/**
 * 调用本地 Ollama API (非流式)
 */
async function callOllamaAPI(prompt, systemPrompt) {
    console.log(`[AI] 调用 Ollama API: ${OLLAMA_URL}, 模型: ${OLLAMA_MODEL}`);

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            stream: false,
            options: {
                temperature: 0.7,
                num_ctx: 4096
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Ollama API 错误: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.message?.content || '';
}

const generateContent = callOllamaAPI;

// ============ 数据获取函数 ============

async function getProvinceData(year) {
    try {
        const { rows } = await pool.query(`
            SELECT 
                year,
                MAX(CASE WHEN land_use_type = 'Cropland' THEN area END) as cropland,
                MAX(CASE WHEN land_use_type = 'Forest' THEN area END) as forest,
                MAX(CASE WHEN land_use_type = 'Shrub' THEN area END) as shrub,
                MAX(CASE WHEN land_use_type = 'Grassland' THEN area END) as grassland,
                MAX(CASE WHEN land_use_type = 'Water' THEN area END) as water,
                MAX(CASE WHEN land_use_type = 'Snow/Ice' THEN area END) as snow_ice,
                MAX(CASE WHEN land_use_type = 'Barren' THEN area END) as barren,
                MAX(CASE WHEN land_use_type = 'Impervious' THEN area END) as impervious,
                MAX(CASE WHEN land_use_type = 'Wetland' THEN area END) as wetland
            FROM clcd_province 
            WHERE year = $1
            GROUP BY year
        `, [year]);
        return rows;
    } catch (e) {
        console.error('[AI] 获取省级数据失败:', e.message);
        return [];
    }
}

async function getHistoricalTrend(year, fullHistory = false) {
    const startYear = fullHistory ? 1985 : Math.max(1990, year - 4);
    try {
        const { rows } = await pool.query(`
            SELECT 
                year,
                MAX(CASE WHEN land_use_type = 'Cropland' THEN area END)/1000000 as cropland,
                MAX(CASE WHEN land_use_type = 'Forest' THEN area END)/1000000 as forest,
                MAX(CASE WHEN land_use_type = 'Impervious' THEN area END)/1000000 as impervious
            FROM clcd_province 
            WHERE year BETWEEN $1 AND $2
            GROUP BY year 
            ORDER BY year
        `, [startYear, year]);
        return rows;
    } catch (e) {
        console.error('[AI] 获取历史趋势失败:', e.message);
        return [];
    }
}

async function getPrefectureRanking(year) {
    try {
        const { rows } = await pool.query(`
            SELECT region_name, 
                COALESCE(cropland, 0)/1000000 as cropland,
                COALESCE(forest, 0)/1000000 as forest,
                COALESCE(impervious, 0)/1000000 as impervious
            FROM clcd_prefecture 
            WHERE year = $1
            ORDER BY impervious DESC
            LIMIT 5
        `, [year]);
        return rows;
    } catch (e) {
        console.error('[AI] 获取地级市排名失败:', e.message);
        return [];
    }
}

async function getAllPrefectureData(year) {
    try {
        const { rows } = await pool.query(`
            SELECT region_name, 
                COALESCE(cropland, 0) as cropland,
                COALESCE(forest, 0) as forest,
                COALESCE(grassland, 0) as grassland,
                COALESCE(water, 0) as water,
                COALESCE(impervious, 0) as impervious
            FROM clcd_prefecture 
            WHERE year = $1
            ORDER BY impervious DESC
        `, [year]);
        return rows;
    } catch (e) {
        console.error('[AI] 获取全量地级市数据失败:', e.message);
        return [];
    }
}

async function getPrefectureHistoricalTrend(prefectureName, yearStart, yearEnd) {
    try {
        const { rows } = await pool.query(`
            SELECT year, 
                COALESCE(cropland, 0)/1000000 as cropland,
                COALESCE(forest, 0)/1000000 as forest,
                COALESCE(impervious, 0)/1000000 as impervious
            FROM clcd_prefecture 
            WHERE TRIM(region_name) = $1 AND year BETWEEN $2 AND $3
            ORDER BY year
        `, [prefectureName.trim(), yearStart, yearEnd]);
        return rows;
    } catch (e) {
        console.error('[AI] 获取地级市历史趋势失败:', e.message);
        return [];
    }
}

async function getCountyDataByPrefecture(prefecture, year) {
    try {
        const { rows } = await pool.query(`
            SELECT c.region_name, 
                COALESCE(c.cropland, 0) as cropland,
                COALESCE(c.forest, 0) as forest,
                COALESCE(c.impervious, 0) as impervious
            FROM clcd_county c
            JOIN yunnan_country_level_city_boundaries b 
              ON TRIM(c.region_name) = TRIM(b.县级)
            WHERE b.地级 = $1 AND c.year = $2
            ORDER BY c.impervious DESC
        `, [prefecture.trim(), year]);
        return rows;
    } catch (e) {
        console.error('[AI] 获取区县数据失败:', e.message);
        return [];
    }
}

// ============ 核心逻辑：按需加载与并行查询 ============

function analyzeQuestion(question) {
    const needs = {
        provinceData: false,
        historicalTrend: false,
        fullHistory: false,
        prefectureRanking: false,
        allPrefectures: false,
        prefectureTrend: false,
        countyData: false,
        targetPrefecture: null,
        isChatOnly: false
    };

    if (!question || question.trim().length < 2) {
        needs.isChatOnly = true;
        return needs;
    }

    const q = question.toLowerCase();
    const chatKeywords = ['你好', '您好', '嗨', 'hello', 'hi', '你是谁', '谁做的', '功能', '帮助', '谢谢', '再见'];
    const dataKeywords = ['数据', '面积', '耕地', '林地', '草地', '建设', '水域', '趋势', '变化', '历史', '对比', '排名', '昆明', '曲靖', '玉溪', '保山', '昭通', '丽江', '普洱', '临沧', '楚雄', '红河', '文山', '西双版纳', '大理', '德宏', '怒江', '迪庆', '县', '区', '市', '州', '19', '20'];

    const isChat = chatKeywords.some(k => q.includes(k));
    const hasData = dataKeywords.some(k => q.includes(k));

    if (isChat && !hasData) {
        needs.isChatOnly = true;
        return needs;
    }

    const prefectures = ['昆明', '曲靖', '玉溪', '保山', '昭通', '丽江', '普洱', '临沧', '楚雄', '红河', '文山', '西双版纳', '大理', '德宏', '怒江', '迪庆'];
    for (const p of prefectures) {
        if (question.includes(p)) {
            needs.targetPrefecture = p.endsWith('市') || p.endsWith('州') ? p : (['西双版纳', '红河', '文山', '楚雄', '大理', '德宏', '怒江', '迪庆'].includes(p) ? p + '州' : p + '市');
            needs.prefectureTrend = true;
            needs.countyData = true;
            break;
        }
    }

    if (q.includes('对比') || q.includes('比较') || q.includes('排名') || q.includes('各地')) {
        needs.allPrefectures = true;
        needs.prefectureRanking = true;
    }

    if (q.includes('趋势') || q.includes('变化') || q.includes('历史')) {
        needs.historicalTrend = true;
        if (q.includes('1985') || q.includes('全部') || q.includes('长期')) needs.fullHistory = true;
    }

    if (q.includes('区县') || q.includes('县')) needs.countyData = true;
    if (q.includes('全省') || q.includes('云南') || q.includes('面积')) needs.provinceData = true;

    if (hasData && !Object.values(needs).some(v => v === true)) {
        needs.provinceData = true;
    }

    return needs;
}

async function buildRichContext(year, region, question) {
    const startTime = Date.now();
    const needs = analyzeQuestion(question);

    if (needs.isChatOnly) {
        console.log(`[AI] 识别为闲聊，跳过上下文构建`);
        return "";
    }

    if (region && region !== '云南省') {
        needs.targetPrefecture = region;
        needs.prefectureTrend = true;
    }

    const queries = {};
    if (needs.provinceData) queries.province = getProvinceData(year);
    if (needs.historicalTrend) queries.trend = getHistoricalTrend(year, needs.fullHistory);
    if (needs.prefectureRanking) queries.ranking = getPrefectureRanking(year);
    if (needs.allPrefectures) queries.allPref = getAllPrefectureData(year);
    if (needs.targetPrefecture && needs.prefectureTrend) queries.prefTrend = getPrefectureHistoricalTrend(needs.targetPrefecture, Math.max(1990, year - 10), year);
    if (needs.targetPrefecture && needs.countyData) queries.county = getCountyDataByPrefecture(needs.targetPrefecture, year);

    const results = await Promise.all(Object.values(queries));
    const data = {};
    Object.keys(queries).forEach((key, index) => { data[key] = results[index]; });

    let context = `## 地理空间分析上下文 (${year}年)\n\n`;

    if (data.province?.length > 0) {
        const r = data.province[0];
        const f = v => (v / 1e6).toFixed(2);
        context += `### 云南省现状\n- 耕地: ${f(r.cropland)} km² | 林地: ${f(r.forest)} km² | 建设用地: ${f(r.impervious)} km²\n\n`;
    }

    if (data.trend?.length > 1) {
        context += `### 历史趋势\n| 年份 | 耕地 | 林地 | 建设用地 |\n|---|---|---|---|\n`;
        data.trend.forEach(r => { context += `| ${r.year} | ${Number(r.cropland).toFixed(1)} | ${Number(r.forest).toFixed(1)} | ${Number(r.impervious).toFixed(1)} |\n`; });
        context += `\n`;
    }

    if (data.prefTrend?.length > 1) {
        context += `### ${needs.targetPrefecture}趋势\n| 年份 | 耕地 | 林地 | 建设用地 |\n|---|---|---|---|\n`;
        data.prefTrend.forEach(r => { context += `| ${r.year} | ${Number(r.cropland).toFixed(1)} | ${Number(r.forest).toFixed(1)} | ${Number(r.impervious).toFixed(1)} |\n`; });
        context += `\n`;
    }

    console.log(`[AI] 上下文构建耗时: ${Date.now() - startTime}ms`);
    return context;
}

// ============ 路由处理 ============

const SYSTEM_PROMPT = `你是云南省土地利用变化(LUCC)分析专家系统。请严格遵守以下输出规范：
1. 充分利用提供的地理空间数据上下文进行专业、严谨的分析。
2. 使用 Markdown 格式使内容易于阅读，包括使用适当的层级标题。
3. 关键数据和重要结论请使用 **加粗** 显示。
4. 涉及多项数据对比或详细列表时，优先使用 Markdown 表格展示。
5. 保持简洁、专业的中文表达风格，直接回答用户问题或提供深度洞察。`;

router.post('/analyze-stream', async (req, res) => {
    const { year, messages, question, landData, region, model } = req.body;
    const selectedModel = model || OLLAMA_MODEL;
    let history = messages || (question ? [{ role: 'user', content: question }] : []);

    if (history.length === 0) return res.status(400).json({ error: '请提供问题' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        const lastUserMsg = history.filter(m => m.role === 'user').pop()?.content || '';
        const richContext = await buildRichContext(year || 2020, region, lastUserMsg);

        const fullMessages = [{ role: 'system', content: SYSTEM_PROMPT }];
        if (richContext) fullMessages.push({ role: 'system', content: `数据背景：\n${richContext}` });
        fullMessages.push(...history);

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

        const reader = ollamaRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);
                    if (json.message?.thought) {
                        res.write(`data: ${JSON.stringify({ content: `<think>${json.message.thought}</think>` })}\n\n`);
                    }
                    if (json.message?.content) {
                        res.write(`data: ${JSON.stringify({ content: json.message.content })}\n\n`);
                    }
                    if (json.done) {
                        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                    }
                } catch (e) {
                    console.error('[AI] 解析 Ollama 响应行失败:', e.message, 'Line:', line);
                }
            }
        }

        if (buffer.trim()) {
            try {
                const json = JSON.parse(buffer);
                if (json.message?.thought) res.write(`data: ${JSON.stringify({ content: `<think>${json.message.thought}</think>` })}\n\n`);
                if (json.message?.content) res.write(`data: ${JSON.stringify({ content: json.message.content })}\n\n`);
                if (json.done) res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            } catch (e) { }
        }

        res.end();
    } catch (err) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
});

// 保持其他路由完整性 (suggestions 等)
router.get('/suggestions', (req, res) => {
    res.json({ success: true, suggestions: ['分析当前土地利用结构', '耕地变化趋势分析', '建设用地扩张特点'] });
});

// 添加 /chat 路由作为 /analyze-stream 的别名（兼容性）
router.post('/chat', async (req, res) => {
    const { year, messages, question, landData, region, model } = req.body;
    const selectedModel = model || OLLAMA_MODEL;
    let history = messages || (question ? [{ role: 'user', content: question }] : []);

    if (history.length === 0) return res.status(400).json({ error: '请提供问题' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        const lastUserMsg = history.filter(m => m.role === 'user').pop()?.content || '';
        const richContext = await buildRichContext(year || 2020, region, lastUserMsg);

        const fullMessages = [{ role: 'system', content: SYSTEM_PROMPT }];
        if (richContext) fullMessages.push({ role: 'system', content: `数据背景：\n${richContext}` });
        fullMessages.push(...history);

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

        const reader = ollamaRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);
                    if (json.message?.thought) {
                        res.write(`data: ${JSON.stringify({ content: `<think>${json.message.thought}</think>` })}\n\n`);
                    }
                    if (json.message?.content) {
                        res.write(`data: ${JSON.stringify({ content: json.message.content })}\n\n`);
                    }
                    if (json.done) {
                        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                    }
                } catch (e) {
                    console.error('[AI] 解析 Ollama 响应行失败:', e.message, 'Line:', line);
                }
            }
        }

        if (buffer.trim()) {
            try {
                const json = JSON.parse(buffer);
                if (json.message?.thought) res.write(`data: ${JSON.stringify({ content: `<think>${json.message.thought}</think>` })}\n\n`);
                if (json.message?.content) res.write(`data: ${JSON.stringify({ content: json.message.content })}\n\n`);
                if (json.done) res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            } catch (e) { }
        }

        res.end();
    } catch (err) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
});

export default router;
