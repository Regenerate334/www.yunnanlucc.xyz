/**
 * build_aligned_kg_v10.js
 * 
 * 职责：
 * 1. 修正 action_template，使其与 clcdTool.js 的参数结构（query_type, region, year）严格一致。
 */

import pool from '../../server/config/db.js';
import fs from 'fs/promises';
import path from 'path';

const ONTOLOGY_PATH = path.resolve('server/mcp/ontology.json');
const KG_PATH = path.resolve('server/mcp/knowledge_graph.json');

async function main() {
    console.log('--- 正在铸造 v10.0.0 实战对齐版语义大脑 ---');

    try {
        const ontology = JSON.parse(await fs.readFile(ONTOLOGY_PATH, 'utf-8'));
        const kg = {
            metadata: {
                generated_at: new Date().toISOString(),
                version: "10.0.0",
                description: "实战对齐版：模板参数与 clcd_analysis 工具完全一致"
            },
            nodes: [],
            links: []
        };

        const addNode = (id, label, type, props = {}) => {
            const existing = kg.nodes.find(n => n.id === id);
            if (!existing) {
                kg.nodes.push({ id, label, type, ...props });
            } else {
                Object.assign(existing, props);
            }
        };

        const addLink = (source, target, relation, props = {}) => {
            kg.links.push({ source, target, relation, ...props });
        };

        // 1. 行政主干
        addNode('yunnan', '云南省', 'Region', { level: 'province' });
        const prefRes = await pool.query('SELECT DISTINCT region_name FROM public.clcd_prefecture');
        prefRes.rows.forEach(r => addNode(`pref_${r.region_name}`, r.region_name, 'Region', { level: 'prefecture' }));

        const countyRes = await pool.query('SELECT DISTINCT region_name FROM public.clcd_county');
        countyRes.rows.forEach(r => addNode(`county_${r.region_name}`, r.region_name, 'Region', { level: 'county' }));

        // 2. 指类与地类 (核心修正点)
        const landTypes = ontology.entities.LandUseType.categories;
        Object.keys(landTypes).forEach(lt => {
            addNode(lt, landTypes[lt].cn, 'LandUseType', { ...landTypes[lt] });
            // 地类查询模板
            addNode(lt, landTypes[lt].cn, 'LandUseType', {
                action_template: { query_type: "structure", region: "$REGION", year: "$YEAR", land_type: lt }
            });
        });

        const indexDefs = ontology.entities.MonitoringIndex.definitions;
        Object.keys(indexDefs).forEach(idx => {
            addNode(idx, indexDefs[idx].full_name, 'Indicator', {
                // 修正：monitoring 模式只需传 region 和 year，后端会自动计算所有指标
                action_template: { query_type: "monitoring", region: "$REGION", year: "$YEAR" },
                note: `该指标包含在监测分析结果中，无需单独传 index 字段。`
            });
        });

        // 3. 政策
        const policies = ontology.entities.Policy.milestones;
        Object.keys(policies).forEach(pId => addNode(`policy_${pId}`, policies[pId].name, 'Policy', { desc: policies[pId].impact }));

        // 写入
        await fs.writeFile(KG_PATH, JSON.stringify(kg, null, 2));
        console.log(`--- v10.0.0 构建完成！当前模板已与 clcd_analysis 深度对齐。 ---`);
        process.exit(0);
    } catch (err) {
        console.error('v10 构建失败:', err);
        process.exit(1);
    }
}

main();
