/**
 * build_knowledge_graph.js
 * 
 * 职责：
 * 1. 读取 ontology.json 定义。
 * 2. 连接 PostgreSQL，查询所有核心表的元数据。
 * 3. 生成 knowledge_base.json 供 MCP 工具查询。
 */

import pool from '../../server/config/db.js';
import fs from 'fs/promises';
import path from 'path';

const ONTOLOGY_PATH = path.resolve('server/mcp/ontology.json');
const KB_PATH = path.resolve('server/mcp/knowledge_base.json');

async function main() {
    console.log('--- 开始构建 WebGIS 知识库 ---');

    try {
        const ontology = JSON.parse(await fs.readFile(ONTOLOGY_PATH, 'utf-8'));
        const kb = {
            generated_at: new Date().toISOString(),
            ontology_version: ontology.version,
            summary: {
                tables: {}
            },
            entities: {
                regions: [],
                years: [],
                transfer_periods: []
            }
        };

        // 1. 提取时间范围
        console.log('[1/4] 正在提取时间跨度...');
        const yearRes = await pool.query('SELECT DISTINCT year FROM public.clcd_province ORDER BY year');
        kb.entities.years = yearRes.rows.map(r => r.year);

        // 2. 提取区域清单 (地州级)
        console.log('[2/4] 正在提取地州市清单...');
        const regionRes = await pool.query('SELECT DISTINCT region_name FROM public.clcd_prefecture ORDER BY region_name');
        kb.entities.regions = regionRes.rows.map(r => r.region_name);

        // 3. 统计各表数据规模
        console.log('[3/4] 正在统计表规模...');
        const tableSummary = {};
        const staticTables = Object.keys(ontology.database_mapping.static_tables);
        const spatialTables = Object.keys(ontology.database_mapping.spatial_tables);

        for (const table of [...staticTables, ...spatialTables]) {
            try {
                const countRes = await pool.query(`SELECT count(*) as total FROM public."${table}"`);
                tableSummary[table] = {
                    rowCount: parseInt(countRes.rows[0].total),
                    description: (ontology.database_mapping.static_tables[table]?.desc || ontology.database_mapping.spatial_tables[table]?.desc || '')
                };
            } catch (e) {
                console.warn(` - 跳过表 ${table}: ${e.message}`);
            }
        }
        kb.summary.tables = tableSummary;

        // 4. 提取空间转移矩阵的时间段
        console.log('[4/4] 正在提取转移分析时间段...');
        try {
            const colRes = await pool.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_schema = 'public' 
                  AND table_name = 'spatial_county_yunnan_transfer' 
                  AND column_name ~ '^[0-9]{4}_to_[0-9]{4}$'
            `);
            kb.entities.transfer_periods = colRes.rows.map(r => r.column_name.replace('_to_', '->'));
        } catch (e) {
            console.warn(' - 提取转移时间段失败:', e.message);
        }

        // 写入 KB 文件
        await fs.writeFile(KB_PATH, JSON.stringify(kb, null, 2));
        console.log(`--- 知识库构建完成！已写入: ${KB_PATH} ---`);
        process.exit(0);
    } catch (err) {
        console.error('构建失败:', err);
        process.exit(1);
    }
}

main();
