/**
 * 知识图谱查询工具 (Knowledge Graph Query Tool)
 * 职责：把仓库内置 knowledge_graph.json 以“可调用工具”的形式暴露给 AI。
 *
 * 设计目标：
 * 1) 稳定：不依赖外网，不依赖 MCP 进程，直接读本地 JSON（UTF-8）。
 * 2) 可控：输出做精简与截断，避免把整张图谱灌给模型导致上下文溢出。
 * 3) 可解释：返回结构化 JSON 字符串，便于模型引用与二次查询。
 */

import fs from 'fs/promises';
import path from 'path';
import registry from '../../dataSourceRegistry.js';
import logger from '../../../config/logger.js';

const KG_PATH = path.resolve('server/knowledge/graph/knowledge_graph.json');

const MAX_MATCHES = 8;
const MAX_CONNECTIONS = 20;
const MAX_PATHS = 12;

function normalizeStr(v) {
    return (v ?? '').toString().trim();
}

function includesLoose(haystack, needle) {
    const h = normalizeStr(haystack);
    const n = normalizeStr(needle);
    if (!n) return false;
    return h.toLowerCase().includes(n.toLowerCase());
}

function labelOf(node) {
    if (!node) return null;
    return node.label || node.id || null;
}

function buildIndexes(kg) {
    const nodes = Array.isArray(kg?.nodes) ? kg.nodes : [];
    const links = Array.isArray(kg?.links) ? kg.links : [];
    const nodeIndex = new Map(nodes.map(n => [n.id, n]));
    return { nodes, links, nodeIndex };
}

function toSafeJson(obj) {
    // 保持结果“短且稳”，让 LLM 能可靠解析。
    return JSON.stringify(obj, null, 2);
}

function pickNodeBrief(n) {
    if (!n) return null;
    return {
        id: n.id,
        label: n.label,
        type: n.type,
        level: n.level,
        alias: Array.isArray(n.alias) ? n.alias.slice(0, 8) : undefined
    };
}

function filterByRelation(link, relation) {
    if (!relation) return true;
    return link?.relation === relation;
}

function searchNodes(nodes, term) {
    const terms = normalizeStr(term).split(/[,/|]+/).map(t => t.trim()).filter(Boolean);
    if (!terms.length) return [];

    const scored = nodes.map(n => {
        const label = normalizeStr(n.label);
        const aliases = Array.isArray(n.alias) ? n.alias : [];
        let score = 0;
        terms.forEach(t => {
            if (includesLoose(label, t)) score += 2;
            if (aliases.some(a => includesLoose(a, t))) score += 1;
        });
        return { n, score };
    }).filter(x => x.score > 0);

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, MAX_MATCHES).map(x => pickNodeBrief(x.n));
}

function traverseNode({ node_id, relation }, { links, nodeIndex }) {
    const node = nodeIndex.get(node_id);
    if (!node) {
        return {
            error: `未找到节点: ${node_id}`
        };
    }

    const outgoing = links.filter(l =>
        l.source === node_id &&
        !l.is_inverse &&
        filterByRelation(l, relation)
    );
    const incoming = links.filter(l =>
        l.target === node_id &&
        filterByRelation(l, relation)
    );

    const connections = [];
    outgoing.slice(0, Math.floor(MAX_CONNECTIONS / 2)).forEach(l => {
        connections.push({
            direction: 'out',
            relation: l.relation,
            to: pickNodeBrief(nodeIndex.get(l.target)) || { id: l.target }
        });
    });
    incoming.slice(0, Math.floor(MAX_CONNECTIONS / 2)).forEach(l => {
        connections.push({
            direction: 'in',
            relation: l.relation,
            from: pickNodeBrief(nodeIndex.get(l.source)) || { id: l.source }
        });
    });

    return {
        node: pickNodeBrief(node),
        connections
    };
}

function resolveTerm({ term, relation }, { nodes, links, nodeIndex }) {
    const terms = normalizeStr(term).split(/[,/|]+/).map(t => t.trim()).filter(Boolean);
    if (!terms.length) return { error: 'term 不能为空' };

    // 找到第一个较强匹配（label 或 alias）
    const targetNode = nodes.find(n =>
        terms.some(t => includesLoose(n.label, t) || (Array.isArray(n.alias) && n.alias.some(a => includesLoose(a, t))))
    );
    if (!targetNode) {
        return { found: false, term: terms.join(' / '), hint: '可先用 mode=search 扩大匹配范围。' };
    }

    const out = links.filter(l =>
        l.source === targetNode.id &&
        !l.is_inverse &&
        filterByRelation(l, relation)
    );
    const inn = links.filter(l =>
        l.target === targetNode.id &&
        filterByRelation(l, relation)
    );

    return {
        found: true,
        node: pickNodeBrief(targetNode),
        outgoing: out.slice(0, 10).map(l => ({
            relation: l.relation,
            to: pickNodeBrief(nodeIndex.get(l.target)) || { id: l.target }
        })),
        incoming: inn.slice(0, 10).map(l => ({
            relation: l.relation,
            from: pickNodeBrief(nodeIndex.get(l.source)) || { id: l.source }
        })),
        action_template: targetNode.action_template || null
    };
}

function findPaths2Hop({ node_id, target_id, relation }, { links, nodeIndex }) {
    const byRel = (l) => filterByRelation(l, relation);
    const direct = links
        .filter(l => l.source === node_id && l.target === target_id && byRel(l))
        .slice(0, 10)
        .map(l => ({
            relation: l.relation,
            from: pickNodeBrief(nodeIndex.get(l.source)) || { id: l.source },
            to: pickNodeBrief(nodeIndex.get(l.target)) || { id: l.target }
        }));

    const indirect = [];
    // 2-hop search using both outgoing and incoming edges.
    const firstHops = links
        .filter(l => (l.source === node_id || l.target === node_id) && byRel(l))
        .slice(0, 200) // 保护：避免极端图谱导致扫描过大
        .map(l => ({
            rel: l.relation,
            via: l.source === node_id ? l.target : l.source,
            direction: l.source === node_id ? 'out' : 'in'
        }));

    for (const h1 of firstHops) {
        if (indirect.length >= MAX_PATHS) break;
        const secondHops = links.filter(l =>
            ((l.source === h1.via && l.target === target_id) || (l.target === h1.via && l.source === target_id)) &&
            byRel(l)
        );
        for (const h2 of secondHops) {
            if (indirect.length >= MAX_PATHS) break;
            indirect.push({
                step1: {
                    direction: h1.direction,
                    relation: h1.rel,
                    via: pickNodeBrief(nodeIndex.get(h1.via)) || { id: h1.via }
                },
                step2: {
                    relation: h2.relation,
                    target: pickNodeBrief(nodeIndex.get(target_id)) || { id: target_id }
                }
            });
        }
    }

    return { direct, indirect };
}

const knowledgeGraphTool = {
    name: 'knowledge_graph_query',
    description: '查询系统内置知识图谱（语义层），用于政策节点/概念关系/行政层级/算子指令等背景检索。支持 metadata/search/traverse/resolve/path。',
    keywords: ['知识图谱', '图谱', '关系', '节点', '语义', 'Policy', '概念', '关联', '路径'],
    priority: 5,
    parameters: {
        type: 'object',
        properties: {
            mode: {
                type: 'string',
                enum: ['search', 'traverse', 'resolve', 'path', 'metadata'],
                description: '查询模式：metadata(元数据), search(搜索), traverse(遍历节点关系), resolve(解析术语), path(2跳路径)'
            },
            term: {
                type: 'string',
                description: '搜索关键词/术语（mode=search/resolve 时使用）'
            },
            node_id: {
                type: 'string',
                description: '目标节点 ID（mode=traverse/path 时使用）'
            },
            target_id: {
                type: 'string',
                description: '路径终点节点 ID（mode=path 时使用）'
            },
            relation: {
                type: 'string',
                description: '可选：过滤特定 relation 类型'
            }
        },
        required: ['mode']
    },

    async query(args) {
        const mode = normalizeStr(args?.mode);
        const term = normalizeStr(args?.term);
        const node_id = normalizeStr(args?.node_id);
        const target_id = normalizeStr(args?.target_id);
        const relation = normalizeStr(args?.relation);

        logger.info(`[knowledgeGraphTool] mode=${mode}, term=${term || '-'}, node_id=${node_id || '-'}, target_id=${target_id || '-'}, relation=${relation || '-'}`);

        try {
            const kgRaw = await fs.readFile(KG_PATH, 'utf-8');
            const kg = JSON.parse(kgRaw);
            const { nodes, links, nodeIndex } = buildIndexes(kg);

            let result;
            if (mode === 'metadata') {
                result = {
                    version: kg?.metadata?.version || null,
                    generated_at: kg?.metadata?.generated_at || null,
                    description: kg?.metadata?.description || null,
                    stats: {
                        nodes: nodes.length,
                        links: links.length
                    },
                    node_types: [...new Set(nodes.map(n => n.type).filter(Boolean))],
                    relation_types: [...new Set(links.map(l => l.relation).filter(Boolean))]
                };
            } else if (mode === 'search') {
                result = {
                    term,
                    matches: searchNodes(nodes, term)
                };
            } else if (mode === 'traverse') {
                result = traverseNode({ node_id, relation }, { links, nodeIndex });
            } else if (mode === 'resolve') {
                result = resolveTerm({ term, relation }, { nodes, links, nodeIndex });
            } else if (mode === 'path') {
                result = findPaths2Hop({ node_id, target_id, relation }, { links, nodeIndex });
            } else {
                result = { error: `不支持的 mode: ${mode}` };
            }

            return { type: 'knowledge_graph', mode, result };
        } catch (err) {
            logger.error(`[knowledgeGraphTool] 查询失败: ${err.message}`);
            return { type: 'knowledge_graph', mode, error: err.message };
        }
    },

    format(data) {
        const title = `> ### [知识图谱] knowledge_graph_query (${data.mode || 'unknown'})`;
        if (data.error) {
            return [
                title,
                '',
                `> 查询失败：${data.error}`
            ].join('\n');
        }

        // 输出为 JSON 字符串，方便模型二次解析与引用。
        return [
            title,
            '',
            '```json',
            toSafeJson(data.result ?? {}),
            '```',
            '',
            '> *提示：如果要进一步缩小范围，请优先用 `mode=search` 找到 node_id，再用 `mode=traverse/path` 深挖关系。*'
        ].join('\n');
    }
};

registry.register(knowledgeGraphTool);
export default knowledgeGraphTool;
