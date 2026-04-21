import landUseService from '../../services/landUseService.js';
import registry from '../dataSourceRegistry.js';
import logger from '../../config/logger.js';

// 地类编码 → 中文名称
const LAND_CLASS_NAMES = {
    1: '耕地', 2: '林地', 3: '草地', 4: '水体', 5: '建设用地',
    6: '裸地', 7: '冰雪', 8: '湿地', 255: '其他'
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

        // 1. 自动推断年份区间
        if (!periodPrefix && start_year && end_year) {
            const y1 = String(start_year).slice(-2).padStart(2, '0');
            const y2 = String(end_year).slice(-2).padStart(2, '0');
            periodPrefix = `y${y1}${y2}`;
        }

        // 默认取 y0203
        if (!periodPrefix) periodPrefix = 'y0203';

        logger.info(`[transferTool] 查询周期: ${periodPrefix}, 区域: ${region}, 级别: ${level}`);

        try {
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

        const header = `| 转出↓ 转入→ | ${classNames.join(' | ')} | 合计(km²) |`;
        const sep = `|${Array(classes.length + 2).fill('---').join('|')}|`;

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
            return `| **${fromName}** | ${cells.join(' | ')} | ${(rowTotal / 1e6).toFixed(2)} |`;
        });

        return [
            `## 数据背景：${region} 土地利用转移矩阵 (${period} 序列, 单位: km²)`,
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
