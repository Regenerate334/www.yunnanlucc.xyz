/**
 * MCP Tool: knowledge_query（知识图谱查询）
 *
 * 说明：MCP 的 knowledge_query 与后端给模型用的 knowledge_graph_query 是两条线。
 * - MCP: 给 MCP Host 调用
 * - HTTP/AI Tool: 给 Web 端对话与 Agent 工具链调用
 *
 * 两者都读取同一份知识图谱数据：server/knowledge/graph/knowledge_graph.json
 */

import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

const KG_PATH = path.resolve('server/knowledge/graph/knowledge_graph.json');

export function registerKnowledgeQueryTool(server) {
  server.tool(
    'knowledge_query',
    '查询 WebGIS 知识图谱以获取语义背景、行政层级、政策关系及算子指令',
    {
      mode: z
        .enum(['search', 'traverse', 'resolve', 'path', 'metadata'])
        .describe('查询模式：search(搜索), traverse(遍历), resolve(解析), path(路径), metadata(元数据)'),
      term: z.string().optional().describe('搜索关键词'),
      node_id: z.string().optional().describe('目标节点 ID'),
      target_id: z.string().optional().describe('路径终点 ID'),
      relation: z.string().optional().describe('过滤特定关系类型')
    },
    async (args) => {
      try {
        const kg = JSON.parse(await fs.readFile(KG_PATH, 'utf-8'));
        const nodeIndex = new Map((kg.nodes || []).map((n) => [n.id, n]));
        const allLinks = Array.isArray(kg.links) ? kg.links : [];
        const byRelation = (l) => !args.relation || l.relation === args.relation;
        let result = {};

        if (args.mode === 'metadata') {
          result = {
            version: kg?.metadata?.version,
            stats: { nodes: kg?.nodes?.length || 0, links: kg?.links?.length || 0 },
            node_types: [...new Set((kg.nodes || []).map((n) => n.type))],
            relation_types: [...new Set((kg.links || []).map((l) => l.relation))]
          };
        } else if (args.mode === 'search' && args.term) {
          result = {
            summary: `在图谱中找到了与 "${args.term}" 相关的实体`,
            matches: (kg.nodes || [])
              .filter(
                (n) =>
                  String(n.label || '').includes(args.term) ||
                  (Array.isArray(n.alias) && n.alias.some((a) => String(a || '').includes(args.term)))
              )
              .slice(0, 3)
              .map((n) => ({ id: n.id, label: n.label, type: n.type }))
          };
        } else if (args.mode === 'traverse' && args.node_id) {
          const outgoing = allLinks.filter(
            (l) => l.source === args.node_id && !l.is_inverse && byRelation(l)
          );
          const incoming = allLinks.filter((l) => l.target === args.node_id && byRelation(l));
          result = {
            node: nodeIndex.get(args.node_id)?.label,
            connections: [
              ...outgoing.slice(0, 8).map((l) => ({
                direction: 'out',
                rel: l.relation,
                to: nodeIndex.get(l.target)?.label || l.target
              })),
              ...incoming.slice(0, 8).map((l) => ({
                direction: 'in',
                rel: l.relation,
                from: nodeIndex.get(l.source)?.label || l.source
              }))
            ]
          };
        } else if (args.mode === 'resolve' && args.term) {
          const targetNode = (kg.nodes || []).find(
            (n) =>
              String(n.label || '').includes(args.term) ||
              (Array.isArray(n.alias) && n.alias.some((a) => String(a || '').includes(args.term)))
          );
          if (targetNode) {
            const relatedOut = allLinks.filter((l) => l.source === targetNode.id && !l.is_inverse);
            const relatedIn = allLinks.filter((l) => l.target === targetNode.id);
            result = {
              concept: targetNode.label,
              instruction: targetNode.action_template || '建议执行关联层级查询',
              context_logic: [
                ...relatedOut.slice(0, 3).map((l) => `${l.relation} -> ${nodeIndex.get(l.target)?.label || l.target}`),
                ...relatedIn.slice(0, 3).map((l) => `${nodeIndex.get(l.source)?.label || l.source} -> ${l.relation}`)
              ]
            };
          }
        } else if (args.mode === 'path' && args.node_id && args.target_id) {
          const direct = allLinks.filter(
            (l) => l.source === args.node_id && l.target === args.target_id && byRelation(l)
          );
          const indirect = [];

          const firstHops = allLinks
            .filter((l) => (l.source === args.node_id || l.target === args.node_id) && byRelation(l))
            .map((l) => ({
              rel: l.relation,
              via: l.source === args.node_id ? l.target : l.source,
              direction: l.source === args.node_id ? 'out' : 'in'
            }));

          firstHops.forEach((h1) => {
            const secondHops = allLinks.filter(
              (l) =>
                (l.source === h1.via && l.target === args.target_id) ||
                (l.target === h1.via && l.source === args.target_id)
            );
            secondHops.forEach((h2) => {
              if (!byRelation(h2)) return;
              indirect.push({
                step1: {
                  rel: h1.rel,
                  via: h1.via,
                  via_label: nodeIndex.get(h1.via)?.label,
                  direction: h1.direction
                },
                step2: { rel: h2.relation, target: args.target_id, target_label: nodeIndex.get(args.target_id)?.label }
              });
            });
          });

          result = { direct: direct.slice(0, 10), indirect: indirect.slice(0, 10) };
        }

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `知识查询失败: ${e.message}` }], isError: true };
      }
    }
  );
}

