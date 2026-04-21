import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';

// 导入现有的业务能力
import landUseService from '../services/landUseService.js';
import clcdTool from '../utils/tools/clcdTool.js';
import dashboardTool from '../utils/tools/dashboardTool.js';

const KG_PATH = path.resolve('server/mcp/knowledge_graph.json');

const server = new McpServer({
    name: "WebGIS-Professional-Server",
    version: "1.0.0",
});

/**
 * RESOURCES: 将专家技能定义暴露为 MCP 资源
 */
const SKILLS_DIR = path.resolve('server/utils/ai/skills');

server.resource(
    "gis-expert-skills",
    "mcp://gis/skills",
    async (uri) => {
        const files = await fs.readdir(SKILLS_DIR);
        let combinedContent = "# GIS 专家技能库综述\n\n";

        for (const file of files) {
            if (file.endsWith('.md')) {
                const content = await fs.readFile(path.join(SKILLS_DIR, file), 'utf-8');
                combinedContent += `## ${file}\n${content}\n\n`;
            }
        }

        return {
            contents: [{
                uri: uri.href,
                text: combinedContent,
                mimeType: "text/markdown"
            }]
        };
    }
);

/**
 * TOOLS: 封装现有的分析能力
 */

// 1. CLCD 分析工具
server.tool(
    "clcd_analysis",
    "查询云南省土地利用状态和变化（CLCD 数据集）",
    {
        query_type: z.enum(['trend', 'comparison', 'ranking', 'structure', 'monitoring']).describe('查询类型'),
        region: z.string().optional().describe('目标区域'),
        year: z.number().optional().describe('目标年份'),
        year_range: z.array(z.number()).optional().describe('年份区间')
    },
    async (args) => {
        const result = await clcdTool.query(args, {}, 2023);
        const text = clcdTool.format(result, {});
        return { content: [{ type: "text", text }] };
    }
);

// 2. 仪表盘工具
server.tool(
    "dashboard_analysis",
    "获取综合仪表盘数据（包含红线预警和生态排名）",
    {
        year: z.number().describe('分析年份'),
        region: z.string().optional().describe('区域名称')
    },
    async (args) => {
        const result = await dashboardTool.query(args, {}, args.year);
        const text = dashboardTool.format(result, {});
        return { content: [{ type: "text", text }] };
    }
);

// 3. 知识图谱查询工具 (Semantic Layer)
server.tool(
    "knowledge_query",
    "查询 WebGIS 知识图谱以获取语义背景、行政层级、政策关系及算子指令",
    {
        mode: z.enum(['search', 'traverse', 'resolve', 'path', 'metadata']).describe('查询模式：search(搜索), traverse(遍历), resolve(解析), path(路径), metadata(元数据)'),
        term: z.string().optional().describe('搜索关键词'),
        node_id: z.string().optional().describe('目标节点 ID'),
        target_id: z.string().optional().describe('路径终点 ID'),
        relation: z.string().optional().describe('过滤特定关系类型')
    },
    async (args) => {
        try {
            const kg = JSON.parse(await fs.readFile(KG_PATH, 'utf-8'));
            let result = {};

            if (args.mode === 'metadata') {
                result = {
                    version: kg.metadata.version,
                    stats: { nodes: kg.nodes.length, links: kg.links.length },
                    node_types: [...new Set(kg.nodes.map(n => n.type))],
                    relation_types: [...new Set(kg.links.map(l => l.relation))]
                };
            } else if (args.mode === 'search' && args.term) {
                // 精简输出，只返回最重要的前 3 个匹配项，避免 AI 溢出
                result = {
                    summary: `在图谱中找到了与 "${args.term}" 相关的实体`,
                    matches: kg.nodes.filter(n =>
                        n.label.includes(args.term) ||
                        (n.alias && n.alias.some(a => a.includes(args.term)))
                    ).slice(0, 3).map(n => ({ id: n.id, label: n.label, type: n.type }))
                };
            } else if (args.mode === 'traverse' && args.node_id) {
                const links = kg.links.filter(l => l.source === args.node_id && !l.is_inverse);
                result = {
                    node: kg.nodes.find(n => n.id === args.node_id)?.label,
                    connections: links.slice(0, 10).map(l => ({
                        rel: l.relation,
                        to: kg.nodes.find(n => n.id === l.target)?.label || l.target
                    }))
                };
            } else if (args.mode === 'resolve' && args.term) {
                const targetNode = kg.nodes.find(n => n.label.includes(args.term) || (n.alias && n.alias.some(a => a.includes(args.term))));
                if (targetNode) {
                    const related = kg.links.filter(l => l.source === targetNode.id && !l.is_inverse);
                    result = {
                        concept: targetNode.label,
                        instruction: targetNode.action_template || "建议执行关联层级查询",
                        context_logic: related.slice(0, 5).map(l => `${l.relation} -> ${kg.nodes.find(n => n.id === l.target)?.label}`)
                    };
                }
            } else if (args.mode === 'path' && args.node_id && args.target_id) {
                // 新增：简单的一跳或两跳路径发现
                const direct = kg.links.filter(l => l.source === args.node_id && l.target === args.target_id);
                const indirect = [];

                // 二跳发现
                const firstHops = kg.links.filter(l => l.source === args.node_id);
                firstHops.forEach(h1 => {
                    const secondHops = kg.links.filter(l => l.source === h1.target && l.target === args.target_id);
                    secondHops.forEach(h2 => {
                        indirect.push({
                            step1: { rel: h1.relation, via: h1.target, via_label: kg.nodes.find(n => n.id === h1.target)?.label },
                            step2: { rel: h2.relation, target: h2.target }
                        });
                    });
                });

                result = { direct, indirect: indirect.slice(0, 3) };
            }

            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (e) {
            return { content: [{ type: "text", text: `知识查询失败: ${e.message}` }], isError: true };
        }
    }
);

/**
 * 连接 Transport
 */
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("WebGIS MCP Server 已启动 (STDIO 模式)");
}

main().catch((err) => {
    console.error("MCP Server 启动失败:", err);
    process.exit(1);
});
