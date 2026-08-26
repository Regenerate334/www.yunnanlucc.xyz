/**
 * MCP Tool: knowledge_base_lookup
 *
 * 说明：复用后端已有专家知识库工具，只做 MCP 协议封装。
 */

import { z } from 'zod';
import knowledgeTool from '../../utils/tools/knowledge/knowledgeTool.js';
import { toMcpToolError, toMcpToolResponse } from '../utils/toolResponse.js';

export function registerKnowledgeBaseLookupTool(server) {
  server.tool(
    'knowledge_base_lookup',
    '检索专家知识库，获取自适应任务路由、生态监测指标、空间推理与政策解释规则',
    {
      skill_name: z
        .enum(['adaptive_analysis', 'monitoring_indices', 'spatial_reasoning', 'policy_expert'])
        .describe('知识模块名称')
    },
    async (args) => {
      try {
        const result = await knowledgeTool.query(args);
        const text = knowledgeTool.format(result);
        return toMcpToolResponse({
          text,
          structuredContent: {
            tool: 'knowledge_base_lookup',
            args,
            result
          }
        });
      } catch (err) {
        return toMcpToolError(err, '专家知识库检索失败');
      }
    }
  );
}
