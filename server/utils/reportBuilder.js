/**
 * reportBuilder.js — AI 报告构建器（核心模块）
 *
 * 借鉴 PedroReports 的三大设计模式：
 *  1. 结构化 JSON Prompt 输出（强制 AI 按固定 Schema 返回，替代自由文本）
 *  2. 自愈式错误修复（JSON 解析失败 → 调整 Prompt 重试，最多 N 次）
 *  3. 复用 DataRouter 拉取数据上下文（已有能力，无需重写）
 *
 * 与 PedroReports 的主要差异：
 *  - 无需 Python 子进程（WebGIS 数据已在 PostgreSQL 中，无需 pandas 处理）
 *  - 无需 Matplotlib（图表由前端 Chart.js 渲染）
 *  - 后端语言：Node.js（不是 Python）
 */

import agenticRouter from './agenticRouter.js';
import { generateText, extractJSON } from './aiClient.js';

// ── 输出 Schema 定义（注入 Prompt，强制 AI 严格遵循）────────────────────────

const REPORT_JSON_SCHEMA = `
{
  "title": "报告主标题",
  "subtitle": "报告副标题",
  "version": "分析版本号 (如 2.6.0-PEDRO-SPEC)",
  "author": "负责人名称",
  "summary": "分析执行摘要（涵盖核心发现与战略意义，使用 **加粗**）",
  "keyMetrics": [
    {
      "label": "指标名称",
      "value": "带单位的数值",
      "desc": "基于数据的专业解读",
      "trend": [10, 15, 12, 18, 20]
    }
  ],
  "insights": [
    {
      "title": "洞察主题 (如：耕地非农化趋势分析)",
      "content": "深度分析正文",
      "evidence": [
        { "name": "统计指标/现象", "value": "数值", "interpretation": "地学意义解读" }
      ],
      "significance": "该洞察对决策的影响"
    }
  ],
  "matrixRows": [
    {
      "from": "起始地类名称",
      "to_cropland": 0,
      "to_forest": 0,
      "to_grass": 0,
      "to_built": 0,
      "total": 0
    }
  ],
  "recommendations": [
    {
      "target": "对策目标/适用主体",
      "action": "具体的行动方案",
      "expectedOutcome": "预期成效",
      "indicator": "落实监测指标"
    }
  ],
  "limitations": ["数据局限性或分析边界说明"],
  "nextSteps": ["建议后续研究方向"]
}
`;

const REPORT_SYSTEM_PROMPT = `# 角色：地理信息数据科学家 (GIS Data Scientist)

## 核心准则
1. **数据至上 (Data Grounding)**：报告中出现的任何关键指标（面积、比例、水体面积等）必须**首选**【数据背景】或【深度挖掘证据】中的真实数值。严禁在后台已有明确数据的情况下凭空捏造。
2. **证据驱动**：每一个 Insight 必须配合具体的 evidence 统计项。不要只说“林地增加了”，要给出具体数值及其地学意义。
3. **逻辑严密**：遵循“现状 -> 证据 -> 原理 -> 建议”的垂直深挖逻辑。
4. **专业深度**：使用地学专业词汇（景观破碎、生态阈值等），但必须建立在真实数据之上。
4. **自适应输出 (Adaptive Section)**：
   - **关键**：只有当问题涉及“地类转化”、“流转”、“从A变为B”或存在相关矩阵数据时，才输出 \`matrixRows\` 字段。
   - 如果问题只是关于“趋势分析”、“面积统计”或“现状描述”，请**省略** \`matrixRows\` 字段，严禁输出全是 0 的无意义矩阵。
5. **格式严丝合缝**：严禁在 JSON 外输出任何文字，严禁更改 Schema 键名。`;

// ── 核心构建函数 ──────────────────────────────────────────────────────────────

/**
 * 生成结构化报告数据。
 *
 * @param {Object} params
 * @param {string} params.question        - 用户的分析问题
 * @param {number} [params.year=2023]     - 目标年份
 * @param {string} [params.reportTitle]   - 自定义报告标题（可选，AI会生成）
 * @param {Object} [params.componentContext] - 前端面板上下文（可选）
 * @param {string} [params.model]         - 指定模型（可选，默认从 getReportModel() 获取）
 *
 * @returns {Promise<ReportData>} 结构化报告数据
 */
export async function buildReport(params) {
  const { question, year = 2023, reportTitle, componentContext, model, chatContext } = params;

  if (!question || question.trim().length === 0) {
    throw new Error('question 参数不能为空');
  }

  console.log(`[reportBuilder] 开始生成报告 | 问题: "${question}" | 年份: ${year}`);

  // ─ Step 0: 算力优化 - 尝试从对话上下文中提取已有结果 ─────
  // 如果对话上下文已经包含了一份高质量的分析（通常由前序 AgenticRouter 生成），
  // 我们直接将其转化为报告，而不是浪费算力重新生成。
  if (Array.isArray(chatContext) && chatContext.length > 0) {
    const lastAssistantMsg = [...chatContext].reverse().find(m => m.role === 'assistant');
    if (lastAssistantMsg && lastAssistantMsg.content.length > 300) {
      console.log('[reportBuilder] 检测到高质量对话上下文，启动快速转化模式...');
      try {
        const messages = [
          {
            role: 'system', content: `你是一个报告转化专家。用户请求根据已有的对话分析产出一份正式报告。你的任务是将已有的分析内容（context）提取并填入指定的 JSON 格式。

要求：
1. **忠实原意**：严禁自行脑补数据，只能提取 context 中已有的数值。
2. **结构化处理**：将自由文本分析拆解为 title, keyMetrics, insights, recommendations。
3. **极速返回**：只输出 JSON，严禁废话。

${REPORT_JSON_SCHEMA}`
          },
          { role: 'user', content: `请将以下对话内容直接转化为正式分析报告格式：\n\n${lastAssistantMsg.content}` }
        ];
        const fastText = await generateText(messages, { model });
        const fastData = extractJSON(fastText);

        normalizeAndFillReport(fastData, { question, year });
        console.log('[reportBuilder] 快速转化完成，成功节省大量算力');
        return fastData;
      } catch (err) {
        console.error('[reportBuilder] 快速转化失败，退回到全量生成模式:', err.message);
      }
    }
  }

  // ─ Step 1: 加载数据上下文 (全量分析模式) ─────
  let dataContext = '';
  let nativeAnalysis = '';

  try {
    dataContext = await agenticRouter.route(question, componentContext, year);
    console.log(`[reportBuilder] 原始工具数据加载成功，长度: ${dataContext?.length || 0}`);

    // 如果数据量足够，触发原生“数据挖掘” AI 调用 (替代 Python 引擎)
    if (dataContext && dataContext.length > 200) {
      console.log('[reportBuilder] 启动 JS 原生深度数据挖掘 (AI-Chain)...');
      nativeAnalysis = await performDeepAnalysisJS(question, dataContext);
      console.log('[reportBuilder] 原生深度洞察提取成功');
    }
  } catch (err) {
    console.error('[reportBuilder] 数据获取失败:', err.message);
  }

  // ─ Step 2: 构建 Prompt ────────────────────────────────────────────────────
  const enhancedContext = nativeAnalysis
    ? `${dataContext}\n\n### 【深度挖掘证据 (Native Insights)】\n${nativeAnalysis}`
    : dataContext;

  const userContent = buildUserPrompt(question, enhancedContext, reportTitle, chatContext);

  const messages = [
    { role: 'system', content: REPORT_SYSTEM_PROMPT },
    { role: 'user', content: userContent }
  ];

  // ─ Step 3: 调用 AI + 自愈重试 ─────────
  const MAX_PARSE_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_PARSE_RETRIES; attempt++) {
    try {
      console.log(`[reportBuilder] AI 调用 (第 ${attempt} 次)... 模型: ${model || '默认'}`);
      const rawText = await generateText(messages, { model });
      const reportData = extractJSON(rawText);

      // 弹性校验与归一化（自愈而非报错）
      normalizeAndFillReport(reportData, {
        question,
        year,
        dataLength: dataContext.length,
        hasDeepAnalysis: !!nativeAnalysis,
        viz: [] // JS 模式暂不生成动态图表文件，由前端渲染
      });

      console.log(`[reportBuilder] 报告生成成功 | insights: ${reportData.insights?.length ?? 0} 条`);
      return reportData;

    } catch (parseErr) {
      console.warn(`[reportBuilder] 第 ${attempt} 次解析失败: ${parseErr.message}`);

      if (attempt < MAX_PARSE_RETRIES) {
        console.log('[reportBuilder] 启动自愈重试...');
        messages.push({
          role: 'assistant',
          content: '（上一次输出无法解析）'
        });
        messages.push({
          role: 'user',
          content: `上一次输出无法解析（${parseErr.message.slice(0, 100)}）。请确保输出严格符合 JSON Schema。如果输出 matrixRows，其项必须为对象。直接输出 JSON。`
        });
        continue;
      }

      console.error('[reportBuilder] 所有重试失败，使用降级数据');
      return buildFallbackReport(question, year, dataContext, parseErr);
    }
  }
}

// ── 辅助函数 ──────────────────────────────────────────────────────────────────

/**
 * 深度分析预处理器 (Node-Native)
 * 代替原有的 Python 引擎，使用 LLM 对原始统计数据进行预挖掘。
 */
async function performDeepAnalysisJS(question, dataContext) {
  const prompt = `## 任务
你是一个资深地理数据分析专家。请深入分析以下【原始统计数据】，并提取出针对问题“${question}”的关键发现。

## 原始数据
${dataContext}

## 处理要求
1. **识别趋势**：找出数据随年份变化的明显上升、下降或波动。
2. **捕捉极值**：确定面积最大/最小的节点及其背后原因。
3. **关联分析**：分析不同地类之间的此消彼长关系。
4. **异常检测**：指出任何不符合一般地理规律的突变点。
5. **格式**：直接输出专业精炼的分析段落（Markdown 格式），不要输出 JSON。

请直接开始你的深度专家分析：`;

  try {
    return await generateText([
      { role: 'system', content: '你是一个严格的地理学数据挖掘专家。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.1 }); // 降低随机性，确保分析准确
  } catch (e) {
    console.warn('[reportBuilder] 原生深度分析执行异常:', e.message);
    return '';
  }
}

/**
 * 构建用户 Prompt
 */
function buildUserPrompt(question, dataContext, reportTitle, chatContext) {
  const titleHint = reportTitle
    ? `\n用户指定的报告标题参考：${reportTitle}（你可以在此基础上优化）`
    : '';

  const transferHint = question.match(/转化|流转|变为|变化|历史/)
    ? "\n提示：检测到转化/流转相关意图，请务必包含 matrixRows 字段并根据后台数据合理推断流转数值。"
    : "\n提示：若不涉及具体的双向转化流转，可以省略 matrixRows 字段。";

  if (chatContext && chatContext.length >= 100) {
    return `## 任务
你需要将以下【已有 AI 分析结果】整理并格式化为一份专业的 JSON 报告。

## 分析问题
${question}
${titleHint}
${transferHint}

## 已有 AI 分析结果
${chatContext}
## 补充数据背景（如对话内容不完整可参考）
${dataContext || '无'}

## 核心要求
1. **严禁脱离数据**：如果【数据背景】中包含具体的数值（如面积 km²、水体数量等），报告必须准确引用。严禁仅凭地理常识生成与后台数据冲突的内容。
2. **忠实原意**：报告的主题（title）和核心结论（summary）必须紧扣“分析问题”。
3. **格式化提取**：将数据点（面积、比例、趋势）精确提取到相应的 JSON 字段中。
4. **自适应输出**：根据问题意图决定是否包含 matrixRows。
5. **输出 JSON**：严格遵守系统要求的 JSON 结构。`;
  }

  return `## 分析问题
${question}
${titleHint}
${transferHint}

## 数据背景
${dataContext || '（无具体数据，请基于云南省土地利用领域知识合理分析）'}

## 任务
请基于以上数据，严格按照系统要求的 JSON 格式生成专业分析报告。`;
}

/**
 * 弹性归一化：确保数据结构完整。
 */
function normalizeAndFillReport(data, meta) {
  // 1. 基础字段保底
  data.title = data.title || meta.question || '土地利用专题分析报告';
  data.subtitle = data.subtitle || `${meta.year}年度数据监测`;
  data.version = data.version || '2.6.0-PEDRO-PRO';
  data.summary = data.summary || '（摘要生成失败）';

  // 2. 注入元数据
  data.generatedAt = new Date().toLocaleDateString('zh-CN');
  data.question = meta.question;
  data.year = meta.year;
  data.dataLength = meta.dataLength;
  data.hasDeepAnalysis = meta.hasDeepAnalysis;
  data.visualizations = meta.viz || [];

  // 3. 数组项归一化
  const ensurerArray = (key) => {
    if (data[key] !== undefined && !Array.isArray(data[key])) {
      data[key] = [data[key]];
    }
  };

  ['keyMetrics', 'insights', 'recommendations'].forEach(ensurerArray);

  // 4. 重点字段结构修复
  data.insights = (data.insights || []).map(item => {
    if (typeof item === 'string') return { title: '分析洞察', content: item, significance: '' };
    return {
      title: item.title || item.label || '',
      content: item.content || item.desc || item.text || '',
      evidence: Array.isArray(item.evidence) ? item.evidence : [],
      significance: item.significance || ''
    };
  }).filter(ins => ins.content && ins.content.trim().length > 0); // 只有有内容的才显示

  // 5. matrixRows 归一化 (自适应：如果 AI 没有提供或所有行均为 0，则隐藏)
  if (Array.isArray(data.matrixRows) && data.matrixRows.length > 0) {
    const cleanedRows = data.matrixRows.map(row => {
      const r = { from: row.from || '其他/未知' };
      const targets = ['cropland', 'forest', 'grass', 'built'];
      let total = 0;
      targets.forEach(t => {
        const val = parseFloat(row[`to_${t}`] || row[t] || 0);
        r[`to_${t}`] = isNaN(val) ? 0 : val;
        total += r[`to_${t}`];
      });
      r.total = parseFloat(row.total) || total;
      return r;
    }).filter(row => row.total > 0); // 过滤掉全为 0 的行

    if (cleanedRows.length > 0) {
      data.matrixRows = cleanedRows;
    } else {
      delete data.matrixRows;
    }
  } else {
    delete data.matrixRows;
  }

  // 6. keyMetrics 归一化
  data.keyMetrics = (data.keyMetrics || []).map(m => ({
    label: m.label || '指标',
    value: m.value || '0',
    desc: m.desc || '',
    trend: Array.isArray(m.trend) ? m.trend : [0, 0, 0]
  }));
}

/**
 * 降级数据：AI 完全失败时返回一个保底结构（防止前端崩溃）
 */
function buildFallbackReport(question, year, dataContext, err) {
  console.warn('[reportBuilder] 使用降级报告数据，原因:', err.message);
  const title = question.length < 20 ? `${question}分析报告` : `${year}年专题分析报告`;
  return {
    title: title,
    subtitle: `${year}年度土地利用专题数据分析`,
    summary: `本报告针对问题"${question}"进行分析。由于 AI 格式化输出异常，以下为基础框架，建议稍后重试或调整问题描述。`,
    stats: {
      totalArea: '待分析',
      majorChange: '待分析',
      changeRate: '待分析'
    },
    insights: [
      {
        title: '数据概况',
        content: dataContext
          ? `已成功加载 ${dataContext.length} 字符的数据上下文，但 AI 分析格式化失败，请重试。`
          : '未能加载数据上下文，请检查数据路由配置。',
        significance: '建议重新发起报告请求。'
      }
    ],
    recommendations: ['重新发起报告生成请求', '如问题持续，可尝试切换模型'],
    generatedAt: new Date().toLocaleDateString('zh-CN'),
    question,
    year,
    isFallback: true,
    error: err.message.slice(0, 200)
  };
}

export default {
  buildReport
};
