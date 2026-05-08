/**
 * 智能体分析工具注册中心 (Agent Analytical Tools Registry)
 * 职责：定义并声明一系列供大语言模型（如 DeepSeek）在执行 ReAct 流程时调用的空间分析工具集。
 *
 * 修改提示：
 * 1. 每个工具必须提供明确的 `name`、`description` 和 `parameters` (JSON Schema) 声明。
 * 2. 工具的说明信息直接决定了 AI 能否正确路由请求，请尽可能使用详尽、无歧义的提示词描述。
 * 3. 新增工具时，必须在对应的 Tool Executor 中同步实现处理逻辑。
 */
import { FunctionTool } from "llamaindex";
import { z } from "zod";
import clcdTool from "./tools/clcdTool.js";
import dashboardTool from "./tools/dashboardTool.js";
import spatialStatsTool from "./tools/spatialStatsTool.js";
import transferTool from "./tools/transferTool.js";
import weatherTool from "./tools/weatherTool.js";
import knowledgeTool from "./tools/knowledgeTool.js";

const clcdFunctionTool = FunctionTool.from(
    async ({ query_type, region, level, year, year_range, land_type, top_n }) => {
        try {
            // 提供默认值
            const finalQueryType = query_type || 'structure';
            const finalRegion = region || '云南省';
            const args = { query_type: finalQueryType, region: finalRegion, level, year, year_range, land_type, top_n };
            const result = await clcdTool.query(args, {}, year);
            return clcdTool.format(result, {});
        } catch (e) {
            return `CLCD 分析失败: ${e.message}`;
        }
    },
    {
        name: "clcd_analysis",
        description: "查询云南省土地利用状态和变化。query_type 可选。如果需要看近几十年的趋势，必须传year_range如[1985,2023]。",
        parameters: z.object({
            query_type: z.enum(['trend', 'comparison', 'ranking', 'structure', 'monitoring']).optional().describe('查询类型：trend(趋势), comparison(对比), ranking(排名), structure(占比), monitoring(生态指数)'),
            region: z.string().optional().describe('目标区域如"云南省"或"昆明市"，默认：云南省'),
            level: z.enum(['province', 'prefecture', 'county']).optional().describe('区域行政级别，如果是具体的县、区、县级市请务必传 county，州市传 prefecture'),
            year: z.number().optional().describe('目标年份'),
            year_range: z.array(z.number()).optional().describe('年份区间如 [1985, 2023]'),
            land_type: z.string().optional().describe('限定地类如"耕地", "林地"'),
            top_n: z.number().optional().describe('排名查询时的数量限制')
        })
    }
);

const dashboardFunctionTool = FunctionTool.from(
    async ({ year, region, level }) => {
        try {
            const result = await dashboardTool.query({ year, region, level }, {}, year);
            return dashboardTool.format(result, {});
        } catch (e) {
            return `仪表盘查询失败: ${e.message}`;
        }
    },
    {
        name: "dashboard_analysis",
        description: "获取综合仪表盘数据，包括生态面积、城市化空间、动态度、排名及预警信息。支持按区域查看。",
        parameters: z.object({
            year: z.number().describe('目标年份，如 2023'),
            region: z.string().optional().describe('目标区域，如"瑞丽市"'),
            level: z.enum(['province', 'prefecture', 'county']).optional().describe('行政级别')
        })
    }
);

const spatialStatsFunctionTool = FunctionTool.from(
    async ({ yearStart, yearEnd, fromClassStr, toClassStr, region, top_n }) => {
        try {
            const args = { yearStart, yearEnd, fromClassStr, toClassStr, region, top_n };
            const result = await spatialStatsTool.query(args, {}, 2023);
            return spatialStatsTool.format(result, {});
        } catch (e) {
            return `空间重流转查询失败: ${e.message}`;
        }
    },
    {
        name: "spatial_stats_analysis",
        description: "获取土地利用流转的空间统计特征（县域TopN与头部集中度、重心迁移轨迹、标准差椭圆）。当用户要求“前N个县域/头部集中度/偏移距离/方位角/椭圆面积/扁率/单极或多点扩张诊断/净流入净流出”时，优先使用本工具。注意：支持净流入口径：fromClassStr=\"全部\" 表示 *→toClass；支持净流出口径：toClassStr=\"全部\" 表示 fromClass→*。",
        parameters: z.object({
            yearStart: z.number().describe('起始年份，如 1985'),
            yearEnd: z.number().describe('结束年份，如 2023'),
            fromClassStr: z.string().describe('转出地类（可填“全部”表示任意/汇总口径，用于净流入）'),
            toClassStr: z.string().describe('转入地类（可填“全部”表示任意/汇总口径，用于净流出）'),
            region: z.string().optional().describe('目标区域，如"瑞丽市"。如不传则统计全省。'),
            top_n: z.number().optional().describe('核心高发区 TopN 数量（默认 5）')
        })
    }
);

const transferFunctionTool = FunctionTool.from(
    async ({ region, start_year, end_year, period, level }) => {
        try {
            const finalRegion = region || '云南省';
            const args = { region: finalRegion, start_year, end_year, period, level };
            const result = await transferTool.query(args, {}, 2023);
            return transferTool.format(result, {});
        } catch (e) {
            return `流转矩阵查询失败: ${e.message}`;
        }
    },
    {
        name: "land_transfer_analysis",
        description: "查询转移矩阵（区域汇总级别，不返回县域TopN名单）。用于净变化/交换变化/主导转化方向等。若用户要求“前N个县域/头部集中度/空间重心轨迹/标准差椭圆”，请改用 spatial_stats_analysis。",
        parameters: z.object({
            region: z.string().optional().describe('目标区域'),
            level: z.enum(['province', 'prefecture', 'county']).optional().describe('解析精度'),
            start_year: z.number().optional().describe('起始年份'),
            end_year: z.number().optional().describe('结束年份'),
            period: z.string().optional().describe('周期编码')
        })
    }
);

const weatherFunctionTool = FunctionTool.from(
    async ({ city }) => {
        try {
            const result = await weatherTool.query({ city });
            return weatherTool.format(result);
        } catch (e) {
            return `天气查询失败: ${e.message}`;
        }
    },
    {
        name: "weather_query",
        description: "查询实时气象信息（如气温、风力等）。",
        parameters: z.object({
            city: z.string().describe('目标城市名称，如 "昆明"')
        })
    }
);

const knowledgeFunctionTool = FunctionTool.from(
    async ({ skill_name }) => {
        try {
            const result = await knowledgeTool.query({ skill_name });
            return knowledgeTool.format(result);
        } catch (e) {
            return `知识检索失败: ${e.message}`;
        }
    },
    {
        name: "knowledge_base_lookup",
        description: "检索系统专家知识库（专业技能）。当遇到 LULC 指标、LUCC 评价算法或空间推理逻辑不确定时，请务必查询此库。",
        parameters: z.object({
            skill_name: z.enum(['monitoring_indices', 'spatial_reasoning', 'policy_expert']).describe('知识模块名称')
        })
    }
);

export const agentTools = [clcdFunctionTool, dashboardFunctionTool, spatialStatsFunctionTool, transferFunctionTool, weatherFunctionTool, knowledgeFunctionTool];
