import { FunctionTool } from "llamaindex";
import { z } from "zod";
import clcdTool from "./tools/clcdTool.js";
import dashboardTool from "./tools/dashboardTool.js";
import spatialStatsTool from "./tools/spatialStatsTool.js";
import transferTool from "./tools/transferTool.js";
import weatherTool from "./tools/weatherTool.js";
import mapControlTool from "./tools/mapControlTool.js";
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
    async ({ yearStart, yearEnd, fromClassStr, toClassStr, region }) => {
        try {
            const args = { yearStart, yearEnd, fromClassStr, toClassStr, region };
            const result = await spatialStatsTool.query(args, {}, 2023);
            return spatialStatsTool.format(result, {});
        } catch (e) {
            return `空间重流转查询失败: ${e.message}`;
        }
    },
    {
        name: "spatial_stats_analysis",
        description: "获取土地利用流转的空间统计特征（重心迁移轨迹、标准差椭圆）。请务必传递 region 以获得精确的局部空间分析。",
        parameters: z.object({
            yearStart: z.number().describe('起始年份，如 1985'),
            yearEnd: z.number().describe('结束年份，如 2023'),
            fromClassStr: z.string().describe('转出地类'),
            toClassStr: z.string().describe('转入地类'),
            region: z.string().optional().describe('目标区域，如"瑞丽市"。如不传则统计全省。')
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
        description: "查询转移矩阵（地类相互转化）。请根据问题颗粒度传 level (prefecture 或 county)。",
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
            skill_name: z.enum(['monitoring_indices', 'spatial_reasoning']).describe('知识模块名称')
        })
    }
);

const mapControlFunctionTool = FunctionTool.from(
    async ({ action, region, lnglat, zoom }) => {
        try {
            const args = { action, region, lnglat, zoom };
            const result = await mapControlTool.query(args);
            return mapControlTool.format(result);
        } catch (e) {
            return `地图控制失败: ${e.message}`;
        }
    },
    {
        name: "map_control",
        description: "控制 WebGIS 地图视角。可以切换行政区域（如‘切换到宣威市’）、定位或缩放图层。",
        parameters: z.object({
            action: z.enum(['set_region', 'fly_to', 'zoom_in', 'zoom_out']).describe('地图控制动作'),
            region: z.string().optional().describe('目标区域名称'),
            lnglat: z.array(z.number()).optional().describe('经纬度坐标 [lng, lat]'),
            zoom: z.number().optional().describe('缩放层级')
        })
    }
);

export const agentTools = [clcdFunctionTool, dashboardFunctionTool, spatialStatsFunctionTool, transferFunctionTool, weatherFunctionTool, knowledgeFunctionTool, mapControlFunctionTool];
