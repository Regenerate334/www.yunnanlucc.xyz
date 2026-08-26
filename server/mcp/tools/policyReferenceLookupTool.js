/**
 * MCP Tool: policy_reference_lookup
 *
 * 说明：复用后端已有政策/规划文献索引检索工具，只做 MCP 协议封装。
 */

import { z } from 'zod';
import policyReferenceTool from '../../utils/tools/knowledge/policyReferenceTool.js';
import { toMcpToolError, toMcpToolResponse } from '../utils/toolResponse.js';

export function registerPolicyReferenceLookupTool(server) {
  server.tool(
    'policy_reference_lookup',
    '检索政策/规划文献索引，返回可引用条目与来源链接；在 Agent 对话中命中后会自动读取来源网页正文',
    {
      region: z.string().optional().describe('区域名称，如“云南省”“昆明市”'),
      year: z.number().optional().describe('目标年份，如 2019'),
      year_range: z.array(z.number()).optional().describe('年份区间，如 [2019, 2020]'),
      keywords: z.array(z.string()).optional().describe('关键词数组'),
      level: z.enum(['national', 'province', 'city', 'county']).optional().describe('政策层级'),
      top_n: z.number().optional().describe('返回条目数量，默认 5，最大 20')
    },
    async (args) => {
      try {
        const result = await policyReferenceTool.query(args);
        const text = policyReferenceTool.format(result);
        return toMcpToolResponse({
          text,
          structuredContent: {
            tool: 'policy_reference_lookup',
            args,
            result
          }
        });
      } catch (err) {
        return toMcpToolError(err, '政策/规划文献检索失败');
      }
    }
  );
}
