/**
 * MCP Tool: web_fetch
 *
 * 说明：复用后端网页资料读取工具，只做 MCP 协议封装。
 */

import { z } from 'zod';
import webFetchTool from '../../utils/tools/knowledge/webFetchTool.js';
import { toMcpToolError, toMcpToolResponse } from '../utils/toolResponse.js';

export function registerWebFetchTool(server) {
  server.tool(
    'web_fetch',
    '读取政策/规划文献索引中的来源网页，提取完整公开正文供模型引用；仅允许登记链接或权威公开站点，不执行脚本',
    {
      url: z.string().url().describe('来源网页 URL，优先填写 policy_reference_lookup 返回的 sources 链接')
    },
    async (args) => {
      try {
        const result = await webFetchTool.query(args);
        const text = webFetchTool.format(result);
        return toMcpToolResponse({
          text,
          structuredContent: {
            tool: 'web_fetch',
            args,
            result
          }
        });
      } catch (err) {
        return toMcpToolError(err, '网页资料读取失败');
      }
    }
  );
}
