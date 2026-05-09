/**
 * AgenticRouter.js — 智能体路由分发器
 * 
 * 职责：
 * 1. 接收用户问题，评估需要调用哪些数据工具。
 * 2. 使用 LLM 生成工具执行计划 (Tool Call Plan)。
 * 3. 执行工具并汇总数据上下文。
 */

import { generateText, extractJSON, getChatModel } from './aiClient.js';
import registry from '../../dataSourceRegistry.js';
import logger from '../../../config/logger.js';

const ROUTER_SYSTEM_PROMPT = `你是一个地理信息系统 (GIS) 数据路由专家。
你的任务是根据用户的提问，决定需要调用哪些后台数据工具来获取分析所需的原始数据。

## 可用工具清单
{{TOOL_SPECS}}

## 任务指令
1. 分析用户意图。如果是关于土地利用覆盖分析、面积统计、历史趋势，请使用 clcd_analysis 工具。
2. 如果涉及地类之间的转化、流转、变为，请使用 land_transfer_analysis 工具。
3. 如果用户问题需要多个维度的数据（如：对比趋势与流转），你可以同时调用多个工具。
4. 你必须返回一个 JSON 数组，包含你决定调用的工具及其参数。

## 输出格式 (严格 JSON)
[
  { "tool": "工具名称", "args": { "参数名": "参数值" } }
]

## 注意事项
- 如果用户只是在打招呼或提问非数据相关问题，返回空数组 []。
- 严禁编造工具，只能使用清单中提供的名称。
- 参数必须符合 JSON Schema 要求。
`;

export class AgenticRouter {
    /**
     * 实现智能路由。
     * @param {string} question - 用户当前问题
     * @param {Object} componentContext - 界面上下文
     * @param {number} currentYear - 当前年份环境
     * @param {Array} history - 对话历史
     * @returns {Promise<string>} - 汇总的数据上文 Markdown
     */
    async route(question, componentContext, currentYear = 2023, history = []) {
        try {
            logger.info(`[AgenticRouter] 正在分析数据需求: "${question}"`);
            let contexts = [];

            // 1. 获取工具描述
            const toolSpecs = registry.getToolSpecs();
            const toolSpecsStr = JSON.stringify(toolSpecs, null, 2);

            // 2. 槽位提取与填充 (Slot Filling)
            const prompt = ROUTER_SYSTEM_PROMPT.replace('{{TOOL_SPECS}}', toolSpecsStr) + `
## 显式槽位管理 (Slot Filling)
请在你的推理过程中显式识别以下槽位：
- region: 提到的行政区划
- year: 提到的年份或年份范围
- land_type: 提到的土地利用类型

## 继承规则
- 如果当前用户请求中缺失某个槽位，请从【对话历史】中提取该槽位的最新值作为继承。
- 尤其注意：如果用户说“那1999年的呢”，region 应该从前文继承“玉溪市”或“昆明市”。
`;

            // 构建简洁的历史上文，帮助提取意图
            const contextSummary = history.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');

            const messages = [
                { role: 'system', content: prompt },
                { role: 'user', content: `【对话上下文】\n${contextSummary}\n\n【当前请求】\n用户问题: "${question}"\n默认年份: ${currentYear}\n\n请输出执行计划 (JSON)：` }
            ];

            const planText = await generateText(messages, {
                temperature: 0.1,
                model: getChatModel()
            });

            let plan = [];
            try {
                plan = extractJSON(planText);
                logger.info(`[AgenticRouter] 识别到的计划步骤数: ${plan.length}`);
            } catch (err) {
                logger.warn('[AgenticRouter] 计划解析失败，尝试降级。');
                return '';
            }

            if (!Array.isArray(plan) || plan.length === 0) {
                return '';
            }

            logger.info(`[AgenticRouter] 执行计划: ${JSON.stringify(plan)}`);

            // 4. 并行执行工具
            const results = await Promise.all(plan.map(async (task) => {
                try {
                    const ctx = await registry.callTool(task.tool, task.args, {}, currentYear);
                    return ctx;
                } catch (err) {
                    return `> 工具 [${task.tool}] 调用失败: ${err.message}`;
                }
            }));

            const toolsContext = results.filter(r => !!r).join('\n\n---\n\n');
            if (toolsContext) contexts.push(toolsContext);

            return contexts.join('\n\n---\n\n');

        } catch (err) {
            logger.error('[AgenticRouter] 路由过程崩溃:', err);
            return `> 数据感知层异常: ${err.message}`;
        }
    }
}

export default new AgenticRouter();
