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
    '查询云南省土地利用状态和变化（CLCD 数据集）',
    {
      query_type: z
        .enum(['trend', 'comparison', 'ranking', 'structure', 'monitoring'])
        .describe('查询类型'),
      region: z.string().optional().describe('目标区域'),
      year: z.number().optional().describe('目标年份'),
      year_range: z.array(z.number()).optional().describe('年份区间')
    },
    async (args) => {
      const result = await clcdTool.query(args, {}, 2023);
      const text = clcdTool.format(result, {});
      return { content: [{ type: 'text', text }] };
    }
  );
}

