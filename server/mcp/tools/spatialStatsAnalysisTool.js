/**
 * MCP Tool: spatial_stats_analysis
 *
 * 说明：复用后端已有空间统计工具，只做 MCP 协议封装。
 */

import { z } from 'zod';
import spatialStatsTool from '../../utils/tools/analysis/spatialStatsTool.js';
import { toMcpToolError, toMcpToolResponse } from '../utils/toolResponse.js';

export function registerSpatialStatsAnalysisTool(server) {
  server.tool(
    'spatial_stats_analysis',
    '计算土地利用转移热点、头部集中度、重心迁移轨迹与标准差椭圆参数',
    {
      yearStart: z.number().describe('起始年份，如 1985'),
      yearEnd: z.number().describe('结束年份，如 2023'),
      fromClassStr: z.string().describe('转出地类，如“耕地”；可填“全部”表示净流入'),
      toClassStr: z.string().describe('转入地类，如“建设用地”；可填“全部”表示净流出'),
      region: z.string().optional().describe('目标区域，不传则统计全省'),
      top_n: z.number().optional().describe('核心高发区 TopN 数量，默认 5')
    },
    async (args) => {
      try {
        const result = await spatialStatsTool.query(args, {}, 2023);
        const text = spatialStatsTool.format(result, {});
        return toMcpToolResponse({
          text,
          structuredContent: {
            tool: 'spatial_stats_analysis',
            args,
            result
          }
        });
      } catch (err) {
        return toMcpToolError(err, '空间统计分析失败');
      }
    }
  );
}
