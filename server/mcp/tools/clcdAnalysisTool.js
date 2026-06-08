/**
 * MCP Tool: clcd_analysis
 *
 * 说明：此处复用后端已有的工具实现（Registry 工具），只做 MCP 协议封装。
 */

import { z } from 'zod';
import clcdTool from '../../utils/tools/analysis/clcdTool.js';

export function registerClcdAnalysisTool(server) {
  server.tool(
    'clcd_analysis',
    '查询云南省土地利用状态和变化。query_type 可选。如果需要看近几十年的趋势，必须传 year_range，如 [1985, 2023]',
    {
      query_type: z
        .enum(['trend', 'comparison', 'ranking', 'structure', 'monitoring'])
        .optional()
        .describe('查询类型：trend(趋势), comparison(对比), ranking(排名), structure(占比), monitoring(生态指数)'),
      region: z.string().optional().describe('目标区域，如“云南省”“昆明市”，默认云南省'),
      level: z.enum(['province', 'prefecture', 'county']).optional().describe('区域行政级别，县/区/县级市传 county，州市传 prefecture'),
      year: z.number().optional().describe('目标年份'),
      year_range: z.array(z.number()).optional().describe('年份区间，如 [1985, 2023]'),
      land_type: z.string().optional().describe('限定地类，如“耕地”“林地”'),
      top_n: z.number().optional().describe('排名查询时的数量限制')
    },
    async (args) => {
      const finalArgs = {
        ...args,
        query_type: args.query_type || 'structure',
        region: args.region || '云南省'
      };
      const result = await clcdTool.query(finalArgs, {}, args.year);
      const text = clcdTool.format(result, {});
      return { content: [{ type: 'text', text }] };
    }
  );
}
