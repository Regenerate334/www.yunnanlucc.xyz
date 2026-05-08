/**
 * 土地流转数据源插件
 *
 * 触发词：流转、转移、转化、转入、转出、变为、变成、土地流转、流转矩阵
 * 数据表：spatial_county_yunnan_transfer (宽表格式)
 *
 * 注册方式：此文件只需在 server/index.js 中 import 一次即生效。
 * 无需修改 dataRouter.js 或任何核心文件。
 */

import pool from '../../config/db.js';
import registry from '../dataSourceRegistry.js';
import logger from '../../config/logger.js';

// 地类编码 → 中文名称（用于格式化输出）
const LAND_CLASS_NAMES = {
    // transfer 宽表 8 类编码（灌木并入林地）：
    // 1耕地 2林地(含灌木) 3草地 4水体 5冰雪 6裸地 7建设用地 8湿地
    1: '耕地',
    2: '林地',
    3: '草地',
    4: '水体',
    5: '冰雪',
    6: '裸地',
    7: '建设用地',
    8: '湿地',
    255: '其他'
};

registry.register({
    name: 'land_transfer',
    description: '土地利用转移矩阵',
    priority: 20,   // 高于默认优先级
    keywords: ['流转', '转移', '转化', '转入', '转出', '变为', '变成', '土地流转', '流转矩阵', '转移矩阵', '地类转移'],

    /**
     * 查询土地流转数据。
     * 适配 wide-column 结构的 spatial_county_yunnan_transfer 表
     */
    async query(question, entities, year) {
        const { years, yearRange, prefectures } = entities;
        let periodPrefix = null;

        // 1. 自动推断年份区间 (适配数据库 yYYZZ 格式，如 y0001, y2123)
        const range = yearRange || (years.length >= 2 ? [Math.min(...years), Math.max(...years)] : null);

        if (range) {
            const y1 = String(range[0]).slice(-2).padStart(2, '0');
            const y2 = String(range[1]).slice(-2).padStart(2, '0');
            periodPrefix = `y${y1}${y2}`;
        }

        // 如果未识别到年份对，默认取 y0203 (探测到的最新波段序列之一)
        if (!periodPrefix) {
            periodPrefix = 'y0203';
        }

        logger.info('[transferSource] 尝试查询周期前缀', { periodPrefix });

        try {
            // 2. 动态探测该周期存在哪些列（FC_TC 编码）
            const { rows: colRows } = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'spatial_county_yunnan_transfer' 
                  AND column_name LIKE $1
            `, [`${periodPrefix}_%`]);

            if (colRows.length === 0) {
                return { rows: [], period: periodPrefix, message: `数据库中未找到 ${periodPrefix} 时段的流转字段` };
            }

            // 3. 构建聚合查询 SQL
            let whereClause = '';
            let params = [];
            let regionDesc = '全省';

            if (entities.counties && entities.counties.length > 0) {
                // 优先按县级过滤
                whereClause = `WHERE TRIM(t."地名") = ANY($1)`;
                params.push(entities.counties);
                regionDesc = entities.counties.join(', ');
            } else if (prefectures && prefectures.length > 0) {
                // 其次按地市过滤
                whereClause = `WHERE TRIM(t."地级") = ANY($1)`;
                params.push(prefectures);
                regionDesc = prefectures.join(', ');
            }

            const selectClaims = colRows.map(c => `SUM("${c.column_name}") as "${c.column_name}"`).join(', ');

            const sql = `
                SELECT ${selectClaims}
                FROM public.spatial_county_yunnan_transfer t
                ${whereClause}
            `;

            const { rows: dataRows } = await pool.query(sql, params);
            const rawData = dataRows[0] || {};

            // 4. 将宽表数据转换为标准矩阵格式
            const rows = [];
            Object.entries(rawData).forEach(([col, area]) => {
                if (!area || Number(area) === 0) return;
                const match = col.match(/_(\d)(\d)$/);
                if (match) {
                    rows.push({
                        from_class: parseInt(match[1]),
                        to_class: parseInt(match[2]),
                        area: parseFloat(area)
                    });
                }
            });

            const p1 = periodPrefix.slice(1, 3);
            const p2 = periodPrefix.slice(3, 5);
            const year1 = parseInt(p1) > 50 ? `19${p1}` : `20${p1}`;
            const year2 = parseInt(p2) > 50 ? `19${p2}` : `20${p2}`;

            return {
                rows,
                period: `${year1}-${year2}`,
                type: 'transfer',
                region: regionDesc
            };

        } catch (err) {
            logger.error('[transferSource] 数据库查询失败', { message: err?.message || String(err), stack: err?.stack });
            throw err;
        }
    },

    /**
     * 自定义格式化：将转移矩阵数据格式化为可读的 Markdown 表格。
     */
    format(data, entities) {
        const { rows, period, message } = data;

        if (!rows || rows.length === 0) {
            return `> 土地流转数据：${message || '暂无数据'}`;
        }

        // 构建矩阵：from_class → {to_class: area}
        const matrix = {};
        const allClasses = new Set();

        rows.forEach(r => {
            const from = r.from_class;
            const to = r.to_class;
            const area = Number(r.area || r.transfer_area || 0);

            if (!matrix[from]) matrix[from] = {};
            matrix[from][to] = area;
            allClasses.add(from);
            allClasses.add(to);
        });

        const classes = [...allClasses].sort((a, b) => a - b);
        const classNames = classes.map(c => LAND_CLASS_NAMES[c] || `类${c}`);

        // 表头
        const header = `| 转出↓ 转入→ | ${classNames.join(' | ')} | 合计(km²) |`;
        const sep = `|${Array(classes.length + 2).fill('---').join('|')}|`;

        // 数据行
        const dataRows = classes.map(from => {
            const fromName = LAND_CLASS_NAMES[from] || `类${from}`;
            let rowTotal = 0;
            const cells = classes.map(to => {
                const area = matrix[from]?.[to] || 0;
                rowTotal += area;
                if (from === to) return '_（不变）_';
                const km2 = (area / 1e6).toFixed(2);
                return km2 === '0.00' ? '—' : km2;
            });
            const totalKm2 = (rowTotal / 1e6).toFixed(2);
            return `| **${fromName}** | ${cells.join(' | ')} | ${totalKm2} |`;
        });

        return [
            `## 数据背景：土地利用转移矩阵（${period} 时段，单位: km²）`,
            '',
            header,
            sep,
            ...dataRows,
            '',
            `> 表格说明：行=转出地类，列=转入地类，数值为转移面积（km²）；斜线位置表示未发生转移。`
        ].join('\n');
    }
});

logger.info('[DataSources] 土地流转插件已注册');
