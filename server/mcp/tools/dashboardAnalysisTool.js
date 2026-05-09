/**
 * MCP Tool: dashboard_analysis
 */

import { z } from 'zod';
import dashboardTool from '../../utils/tools/analysis/dashboardTool.js';

export function registerDashboardAnalysisTool(server) {
  server.tool(
    'dashboard_analysis',
    '获取综合仪表盘数据（包含红线预警和生态排名）',
    {
      year: z.number().describe('分析年份'),
      region: z.string().optional().describe('区域名称')
    },
    async (args) => {
      const result = await dashboardTool.query(args, {}, args.year);
      const text = dashboardTool.format(result, {});
      return { content: [{ type: 'text', text }] };
    }
  );
}

