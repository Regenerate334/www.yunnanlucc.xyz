/**
 * MCP Tool: weather_query
 *
 * 说明：复用后端已有实时气象工具，只做 MCP 协议封装。
 */

import { z } from 'zod';
import weatherTool from '../../utils/tools/analysis/weatherTool.js';
import { toMcpToolError, toMcpToolResponse } from '../utils/toolResponse.js';

export function registerWeatherQueryTool(server) {
  server.tool(
    'weather_query',
    '查询实时气象信息（如气温、天气状况、风向风力等）',
    {
      city: z.string().describe('目标城市名称，如“昆明”')
    },
    async (args) => {
      try {
        const result = await weatherTool.query(args);
        const text = weatherTool.format(result);
        return toMcpToolResponse({
          text,
          structuredContent: {
            tool: 'weather_query',
            args,
            result
          }
        });
      } catch (err) {
        return toMcpToolError(err, '天气查询失败');
      }
    }
  );
}
