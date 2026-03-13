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

import { DataRouter } from './dataRouter.js';
import { generateText, extractJSON } from './aiClient.js';

const dataRouter = new DataRouter();

// ── 输出 Schema 定义（注入 Prompt，强制 AI 严格遵循）────────────────────────

const REPORT_JSON_SCHEMA = `
{
  "title": "报告标题（简洁，15字以内）",
  "summary": "执行摘要（3-5句话，对关键发现使用 **加粗**，涵盖核心结论与主要成因）",
  "background": "研究背景与区域概况（200-300字。描述该自治县/市的地貌特征、气候背景、行政定位，以及该时期主要的全国性/区域性土地政策环境）",
  "methodology": "技术指标与方法论说明（100-150字。必须包含以下真实技术点：数据源为武汉大学 CLCD；基于 GEE 平台 33.5万景 Landsat 影像；采用随机森林（Random Forest）分类器；通过时空滤波与逻辑推理校正；总体精度 79.31%。禁止提及马尔科夫或 Kappa）",
  "stats": {
    "totalArea": "涉及区域总面积（带单位，如 39.4万 km²）",
    "majorChange": "最显著的土地利用变化方向（如 耕地→林地）",
    "changeArea": "显著变化的面积（带符号，如 **+2386** km²）",
    "changeRate": "核心变化率（百分比形式，如 **+1.24%**）",
    "activeCounties": "流转活跃县域数量/名称提示"
  },
  "landTypeAnalysis": [
    {
      "type": "地类名称（如 耕地）",
      "status": "现状描述（2-3句话，包含该地类在区域内的空间权重和关键指标加粗）",
      "trend": "演变趋势（2-3句话，详细分析其转入/转出来源，带实测数据并加粗）"
    }
  ],
  "matrixRows": [
    {
      "from": "起始地类名称",
      "to_cropland": "转为耕地的数值",
      "to_forest": "转为林地的数值",
      "to_grass": "转为草地的数值",
      "to_shrub": "转为灌木的数值（如有）",
      "to_water": "转为水域的数值",
      "total": "该行总流转面积"
    }
  ],
  "spatialDynamics": [
    {
      "region": "区域名称",
      "pattern": "格局特征描述（3-5句话。分析该子区域的流转聚集性、垂直分布特性或城乡边缘效应，关键发现加粗）"
    }
  ],
  "insights": [
    {
      "title": "洞察标题（8字以内）",
      "content": "深度分析（4-6句话。不仅描述‘是什么’，更要分析‘为什么’。关联地形、人口、政策等驱动因子。对核心对比数据使用 **加粗**）",
      "significance": "业务/生态意义（2句话，提炼对国土空间规划的指导价值）"
    }
  ],
  "recommendations": [
    "具体可行的建议（动词开头，需区分短期治理与长期规划，关键点加粗）"
  ]
}
`;

// insights 建议至少 2 条，recommendations 建议 2-4 条
const REPORT_SYSTEM_PROMPT = `# 角色：云南 GIS 数据分析专家

你的任务是基于提供的【数据背景】生成专业的土地利用分析报告。

## 输出格式要求（严格遵守）
你必须且只能输出以下 JSON 格式，不得包含任何额外的解释文字、代码块标记或注释：

${REPORT_JSON_SCHEMA}

## 分析准则
1. **数据严谨性**：核心流转数值（如面积、变化率）必须来自提供的【数据背景】，禁止编造。
2. **背景详实性**：background 字段需结合通用地理常识与政策背景，描述该区域的地貌特征、气候带及土地利用政策（如退耕还林、三区三线）。要求文字详尽且具有专业深度，建议 200-300 字。
## 技术专业度要求（真实事实）
- **数据源**：武汉大学杨杰和黄昕团队开发的 CLCD (China Land Cover Dataset)。
- **方法论核心**：基于 GEE 平台的 33.5万景 Landsat 影像，采用【随机森林（Random Forest）】分类器，结合【多时相特征】，并经过【时空滤波（Spatio-temporal filtering）】和【逻辑推理（Logical reasoning）】。
- **精度事实**：总体分类精度（Overall Accuracy）为 79.31%。
- **由于 CLCD 是逐年观测数据，分析其变化时无需使用马尔科夫预测模型。**

## 负面约束（禁止出现以下内容）
- **绝对禁止提及“马尔科夫转移矩阵”或“Markov”**（本研究不涉及预测模型）。
- **绝对禁止提及“Kappa 系数”或“0.86”**（CLCD 官方验证指标为总体精度 79.31%）。
- 禁止编造数据来源，必须注明 [Yang and Huang, 2021, ESSD]。
- methodology 字段必须包含 DOI：https://doi.org/10.5281/zenodo.4417810。

## 严格格式限制
- 禁止输出纯 JSON 以外的任何干扰文字（如“收到”、“正在生成”等）。
- 禁止使用 \`\`\`json 或 \`\`\` 包裹输出块，直接输出 JSON 字符串。
- 确保输出的对象结构严谨，符合 JavaScript JSON.parse() 解析规范。项目包含 title, summary, background, methodology, stats, landTypeAnalysis, matrixRows, spatialDynamics, insights, recommendations。 必须严格对应。
- **深度洞察**：insights 字段不仅描述现象，更要剖析驱动因子（地形、人口、政策）。对核心结论和对比数据使用 **加粗**。
- **实用对策**：recommendations 应具备可操作性，区分短期与中长期规划，关键动作 **加粗**。`;

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
    const { question, year = 2023, reportTitle, componentContext, model } = params;

    if (!question || question.trim().length === 0) {
        throw new Error('question 参数不能为空');
    }

    console.log(`[reportBuilder] 开始生成报告 | 问题: "${question}" | 年份: ${year}`);

    // ─ Step 1: 数据路由，复用 DataRouter 拉取上下文（与 chat.js 同款能力）─────
    let dataContext = '';
    try {
        dataContext = await dataRouter.route(question, componentContext, year);
        console.log(`[reportBuilder] 数据上下文已加载，长度: ${dataContext.length}`);
    } catch (err) {
        console.error('[reportBuilder] 数据路由失败:', err.message);
        dataContext = `> 数据加载失败: ${err.message}，请基于领域知识生成报告框架。`;
    }

    // ─ Step 2: 构建 Prompt ────────────────────────────────────────────────────
    const userContent = buildUserPrompt(question, dataContext, reportTitle);

    const messages = [
        { role: 'system', content: REPORT_SYSTEM_PROMPT },
        { role: 'user', content: userContent }
    ];

    // ─ Step 3: 调用 AI + 自愈重试（借鉴 PedroReports CodeFixer 模式）─────────
    const MAX_PARSE_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_PARSE_RETRIES; attempt++) {
        try {
            console.log(`[reportBuilder] AI 调用 (第 ${attempt} 次)... 模型: ${model || '默认'}`);
            const rawText = await generateText(messages, { model });
            const reportData = extractJSON(rawText);

            // 校验关键字段
            validateReportData(reportData);

            // 注入元数据
            reportData.generatedAt = new Date().toLocaleDateString('zh-CN');
            reportData.question = question;
            reportData.year = year;
            reportData.dataLength = dataContext.length;

            console.log(`[reportBuilder] 报告生成成功 | insights: ${reportData.insights?.length ?? 0} 条`);
            return reportData;

        } catch (parseErr) {
            console.warn(`[reportBuilder] 第 ${attempt} 次解析失败: ${parseErr.message}`);

            if (attempt < MAX_PARSE_RETRIES) {
                // 自愈：将错误信息反馈给 AI，要求修正（CodeFixer 核心思路）
                console.log('[reportBuilder] 启动自愈重试，将错误反馈给 AI...');
                messages.push({
                    role: 'assistant',
                    content: '（上一次输出）' + parseErr.message.slice(0, 200)
                });
                messages.push({
                    role: 'user',
                    content: `上次输出无法解析为合法 JSON，错误信息：${parseErr.message.slice(0, 200)}\n\n请重新输出，并确保 matrixRows 中的数值为数字或带单位的字符串。必须输出纯 JSON 对象。`
                });
                continue;
            }

            // 所有重试均失败，返回降级数据
            console.error('[reportBuilder] 所有重试失败，使用降级数据');
            return buildFallbackReport(question, year, dataContext, parseErr);
        }
    }
}

// ── 辅助函数 ──────────────────────────────────────────────────────────────────

/**
 * 构建用户 Prompt
 */
function buildUserPrompt(question, dataContext, reportTitle) {
    const titleHint = reportTitle
        ? `\n用户指定的报告标题参考：${reportTitle}（你可以在此基础上优化）`
        : '';

    return `## 分析问题
${question}
${titleHint}

## 数据背景
${dataContext || '（无具体数据，请基于云南省土地利用领域知识合理分析）'}

## 任务
请基于以上数据，严格按照系统要求的 JSON 格式生成专业分析报告。`;
}

/**
 * 校验报告数据结构的完整性
 */
function validateReportData(data) {
    const required = ['title', 'summary', 'insights', 'recommendations'];
    const missing = required.filter(k => !data[k]);
    if (missing.length > 0) {
        throw new Error(`报告数据缺少必要字段: ${missing.join(', ')}`);
    }
    if (!Array.isArray(data.insights) || data.insights.length === 0) {
        throw new Error('insights 必须是非空数组');
    }
    if (!Array.isArray(data.recommendations)) {
        throw new Error('recommendations 必须是数组');
    }
}

/**
 * 降级数据：AI 完全失败时返回一个保底结构（防止前端崩溃）
 */
function buildFallbackReport(question, year, dataContext, err) {
    console.warn('[reportBuilder] 使用降级报告数据，原因:', err.message);
    return {
        title: `${year}年土地利用分析报告`,
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
