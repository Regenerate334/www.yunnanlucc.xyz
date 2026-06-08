/**
 * MCP Tool: dashboard_analysis
 */

import { z } from 'zod';
import dashboardTool from '../../utils/tools/analysis/dashboardTool.js';

export function registerDashboardAnalysisTool(server) {
  server.tool(
    'dashboard_analysis',
    '获取综合仪表盘数据，包括生态面积、城市化空间、动态度、排名及预警信息，支持按区域查看',
    {
      year: z.number().describe('目标年份，如 2023'),
      region: z.string().optional().describe('目标区域，如“瑞丽市”'),
      level: z.enum(['province', 'prefecture', 'county']).optional().describe('行政级别')
    },
    async (args) => {
      const result = await dashboardTool.query(args, {}, args.year || 2023);
      const text = dashboardTool.format(result, {});
      return { content: [{ type: 'text', text }] };
    }
  );
}
