/**
 * Agent 专用执行工具 (Agent Dedicated Tool Executor)
 * 职责：作为 Agent 动作节点，提供针对 transferTool 维度的真实数据获取及格式化封装。
 *
 * 修改提示：
 * 1. 返回值需最大程度扁平化和自然语言化，便于大模型理解和吸收。
 * 2. 若涉及异步操作，请务必处理 Promise 的 catch 块防止未捕获异常。
 * 3. 遵循现有的 ESLint 和团队代码规范，保持极简及高可读性。
 */
import landUseService from '../../services/landUseService.js';
import registry from '../dataSourceRegistry.js';
import logger from '../../config/logger.js';

// 地类编码 → 中文名称
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

const transferTool = {
    name: 'land_transfer_analysis',
    description: '查询土地利用转移矩阵，分析不同地类之间的相互转化情况。支持按州市、按县级过滤。',
    keywords: ['流转', '转移', '转化', '转入', '转出', '变为', '变成', '土地流转', '流转矩阵', '转移矩阵', '地类转移'],
    parameters: {
        type: 'object',
        properties: {
            region: {
                type: 'string',
                description: '目标区域：如 "云南省", "昆明市", "五华区" 等。'
            },
            start_year: {
                type: 'integer',
                description: '起始年份，如 2000'
            },
            end_year: {
                type: 'integer',
                description: '结束年份，如 2023'
            },
            period: {
                type: 'string',
                description: '可选：直接指定周期编码，如 "y0023" 表示 2000-2023。'
            },
            level: {
                type: 'string',
                enum: ['province', 'prefecture', 'county'],
                description: '行政级别。'
            }
        },
        required: []
    },

    async query(args, entities, year = 2023) {
        let { region, start_year, end_year, period, level } = args;
        let periodPrefix = period;

        // 1. 自动推断年份区间（以数据库真实可用 period 为准）
        // 说明：转移宽表并不一定包含任意 yYYZZ 聚合列（例如 y9023 不一定存在），
        // 因此这里改为：若提供 start/end，则用 period_encoder 挑选覆盖范围内的真实 periods，
        // 然后按多段求和返回矩阵。
        const yearStart = Number.isInteger(Number(start_year)) ? Number(start_year) : null;
        const yearEnd = Number.isInteger(Number(end_year)) ? Number(end_year) : null;

        // 默认周期：避免模型漏参时落到一个不存在的 period（导致空结果）或过短周期。
        // 转移宽表按“逐年(1990-2023) + 特殊段(y8590) + 少量跨年段(y9900)”存储，
        // 不存在 y8523 这类全时段聚合列，因此默认取最近可用年度段（y2223）。
        if (!periodPrefix && !(yearStart && yearEnd)) periodPrefix = 'y2223';

        logger.info(`[transferTool] 查询请求: period=${periodPrefix || 'auto'}, 区域: ${region}, 级别: ${level}, 年份: ${yearStart || '-'}-${yearEnd || '-'}`);

        try {
            // A) 若明确指定 period，沿用旧逻辑
            if (periodPrefix) {
                const rawData = await landUseService.getTransferMatrix(region, periodPrefix, level);

                const rows = [];
                Object.entries(rawData).forEach(([col, area]) => {
                    if (!area || Number(area) === 0) return;
                    const match = col.match(/_(\d)(\d)$/);
                    if (match) {
                        rows.push({ from_class: parseInt(match[1]), to_class: parseInt(match[2]), area: parseFloat(area) });
                    }
                });

                return { rows, period: periodPrefix, type: 'transfer', region: region || '全省' };
            }

            // B) 若给了年份区间，则按实际 periods 求和（更符合用户提问）
            if (yearStart && yearEnd && yearStart < yearEnd) {
                // 注意：跨多年聚合的转移矩阵是“累计转化事件”口径（可能包含同一地块多次震荡），
                // 不适合作为“保持面积/净变化”的严谨闭合矩阵使用。
                const rawData = await landUseService.getTransferMatrixByYearRange(region, yearStart, yearEnd, level);
                const rows = [];
                Object.entries(rawData || {}).forEach(([col, area]) => {
                    if (!area || Number(area) === 0) return;
                    const match = String(col).match(/^(\d)(\d)$/);
                    if (match) {
                        const from = parseInt(match[1]);
                        const to = parseInt(match[2]);
                        // 跨年累计口径下，对角线(保持)没有分析意义，会引入“面积×年”的重复统计，
                        // 因此直接丢弃对角线，避免下游误读。
                        if (from === to) return;
                        rows.push({ from_class: from, to_class: to, area: parseFloat(area) });
                    }
                });
                return { rows, period: `${yearStart}-${yearEnd}`, type: 'transfer', region: region || '全省' };
            }

            // Fallback: no usable params
            return { rows: [], period: periodPrefix || 'unknown', type: 'transfer', region: region || '全省' };
        } catch (err) {
            logger.error('[transferTool] 查询失败:', err);
            throw err;
        }
    },

    format(data, entities) {
        const { rows, period, region } = data;
        if (!rows || rows.length === 0) return `> 土地流转数据：未找到 ${period} 时段的相关记录。`;

        const matrix = {};
        const allClasses = new Set();
        rows.forEach(r => {
            const { from_class, to_class, area } = r;
            if (!matrix[from_class]) matrix[from_class] = {};
            matrix[from_class][to_class] = area;
            allClasses.add(from_class);
            allClasses.add(to_class);
        });

        const classes = [...allClasses].sort((a, b) => a - b);
        const classNames = classes.map(c => LAND_CLASS_NAMES[c] || `类${c}`);

        const toKm2 = (m2) => (Number(m2) || 0) / 1e6;
        const fmt2 = (val) => (Number(val) || 0).toFixed(2);

        // 汇总：净变化/交换变化/保持等（源自转移矩阵分解口径）
        //
        // 注意：当 period 是“多年累计聚合”(例如 1990-2023) 时，本工具不会返回对角线(保持)。
        // 因此下述“保持/净变化/交换变化”并不严格成立，仅保留用于“转化方向强度”扫描。
        const classStats = classes.map((code) => {
            const persistence = Number(matrix[code]?.[code] || 0);

            let outTotal = 0;
            let inTotal = 0;
            classes.forEach((to) => { outTotal += Number(matrix[code]?.[to] || 0); });
            classes.forEach((from) => { inTotal += Number(matrix[from]?.[code] || 0); });

            const loss = Math.max(0, outTotal - persistence);
            const gain = Math.max(0, inTotal - persistence);
            const net = gain - loss;
            const gross = gain + loss;
            const swap = Math.max(0, gross - Math.abs(net)); // = 2 * min(gain, loss)

            return {
                code,
                name: LAND_CLASS_NAMES[code] || `类${code}`,
                persistence,
                gain,
                loss,
                net,
                swap
            };
        });

        const transitions = [];
        classes.forEach((from) => {
            classes.forEach((to) => {
                if (from === to) return;
                const area = Number(matrix[from]?.[to] || 0);
                if (area > 0) transitions.push({ from, to, area });
            });
        });
        transitions.sort((a, b) => b.area - a.area);

        const totalPersistence = classStats.reduce((s, x) => s + x.persistence, 0);
        const totalChange = transitions.reduce((s, x) => s + x.area, 0);

        const header = `| 转出↓ 转入→ | ${classNames.join(' | ')} | 合计(km²) |`;
        const sep = `|${Array(classes.length + 2).fill('---').join('|')}|`;

        const dataRows = classes.map(from => {
            const fromName = LAND_CLASS_NAMES[from] || `类${from}`;
            let rowTotal = 0;
            const cells = classes.map(to => {
                const area = matrix[from]?.[to] || 0;
                rowTotal += area;
                if (from === to) return '_（不变）_';
                const km2 = fmt2(toKm2(area));
                return km2 === '0.00' ? '—' : km2;
            });
            return `| **${fromName}** | ${cells.join(' | ')} | ${fmt2(toKm2(rowTotal))} |`;
        });

        const topTransitions = transitions.slice(0, 8).map((t) => {
            const fromName = LAND_CLASS_NAMES[t.from] || `类${t.from}`;
            const toName = LAND_CLASS_NAMES[t.to] || `类${t.to}`;
            return `- ${fromName}→${toName}: ${fmt2(toKm2(t.area))} km²`;
        });

        const statsHeader = `| 地类 | 转入(km²) | 转出(km²) | 净变化(km²) | 交换变化(km²) | 保持(km²) |`;
        const statsSep = `|---|---:|---:|---:|---:|---:|`;
        const statsRows = classStats.map((s) => {
            return `| ${s.name} | ${fmt2(toKm2(s.gain))} | ${fmt2(toKm2(s.loss))} | ${fmt2(toKm2(s.net))} | ${fmt2(toKm2(s.swap))} | ${fmt2(toKm2(s.persistence))} |`;
        });

        return [
            `## 数据背景：${region} 土地利用转移矩阵 (${period} 序列, 单位: km²)`,
            '',
            `### 变化汇总（仅基于转移矩阵）`,
            `- 总变化面积(非对角线合计): ${fmt2(toKm2(totalChange))} km²`,
            totalPersistence > 0 ? `- 总保持面积(对角线合计): ${fmt2(toKm2(totalPersistence))} km²` : `- 总保持面积(对角线合计): —（跨年累计聚合口径下未提供）`,
            topTransitions.length > 0 ? `- 主要转化方向(Top ${topTransitions.length}):` : `- 主要转化方向: —`,
            ...topTransitions,
            '',
            `### 地类变化分解（转入/转出/净变化/交换变化）`,
            statsHeader,
            statsSep,
            ...statsRows,
            '',
            header,
            sep,
            ...dataRows,
            '',
            `> 说明：该数据展示了${region}在指定时段内地块类型的相互转化情况。`
        ].join('\n');
    }
};

registry.register(transferTool);
export default transferTool;
