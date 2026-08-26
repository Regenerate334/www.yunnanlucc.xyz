/**
 * MCP Tool: knowledge_graph_query
 *
 * 说明：复用后端已有知识图谱查询工具，只做 MCP 协议封装。
 */

import { z } from 'zod';
import knowledgeGraphTool from '../../utils/tools/knowledge/knowledgeGraphTool.js';
import { toMcpToolError, toMcpToolResponse } from '../utils/toolResponse.js';

export function registerKnowledgeGraphQueryTool(server) {
  server.tool(
    'knowledge_graph_query',
    '查询系统内置知识图谱，用于概念、政策、行政层级与算子语义关系检索',
    {
      mode: z
        .enum(['search', 'traverse', 'resolve', 'path', 'metadata'])
        .describe('查询模式'),
      term: z.string().optional().describe('搜索关键词或术语'),
      node_id: z.string().optional().describe('目标节点 ID'),
      target_id: z.string().optional().describe('路径终点节点 ID'),
      relation: z.string().optional().describe('可选关系类型过滤')
    },
    async (args) => {
      try {
        const result = await knowledgeGraphTool.query(args);
        const text = knowledgeGraphTool.format(result);
        return toMcpToolResponse({
          text,
          structuredContent: {
            tool: 'knowledge_graph_query',
            args,
            result
          }
        });
      } catch (err) {
        return toMcpToolError(err, '知识图谱查询失败');
      }
    }
  );
}
