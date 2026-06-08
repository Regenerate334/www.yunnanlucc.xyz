/**
 * MCP Tool: land_transfer_analysis
 *
 * 说明：复用后端已有土地利用转移矩阵工具，只做 MCP 协议封装。
 */

import { z } from 'zod';
import transferTool from '../../utils/tools/analysis/transferTool.js';

export function registerLandTransferAnalysisTool(server) {
  server.tool(
    'land_transfer_analysis',
    '查询区域尺度土地利用转移矩阵，分析转入、转出、净变化与主导转化方向',
    {
      region: z.string().optional().describe('目标区域，如“云南省”“昆明市”“五华区”'),
      level: z.enum(['province', 'prefecture', 'county']).optional().describe('行政级别'),
      start_year: z.number().optional().describe('起始年份，如 2000'),
      end_year: z.number().optional().describe('结束年份，如 2023'),
      period: z.string().optional().describe('周期编码，如 y0023')
    },
    async (args) => {
      const result = await transferTool.query(args, {}, 2023);
      const text = transferTool.format(result, {});
      return { content: [{ type: 'text', text }] };
    }
  );
}

