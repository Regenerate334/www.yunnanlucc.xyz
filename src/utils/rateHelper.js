/**
 * @module utils/rateHelper
 * @description 辅助计算土地利用变化率等专项业务指标的工具。
 * @author System
 * @dependencies 无
 */

import { getTableColumns, ATTR_PREFIX_MAP } from './utils.js';

/**
 * 引用 SQL 标识符（双引号转义）
 * @param {string} id - 标识符
 * @returns {string} 转义后的标识符
 */
export function quoteIdentifier(id) {
    return `"${id.replace(/"/g, '""')}"`;
}

/**
 * 构建安全的率值除法表达式（防止除零错误）
 * @param {string} numerator - 分子表达式
 * @param {string} denominator - 分母表达式
 * @returns {string} CASE WHEN 表达式
 */
export function buildSafeRateExpression(numerator, denominator) {
    return `CASE WHEN (${denominator}) > 0 THEN (${numerator})::double precision / (${denominator}) ELSE 0 END`;
}

/**
 * 构建分析所需的查询片段（表名、列名、转换表达式等）
 * @param {string} unit - 空间尺度 ('county' 或 'grid')
 * @param {number} year - 目标年份
 * @returns {Promise<Object>} 查询片段对象
 */
export async function buildRateQueryFragments(unit, year) {
    const isGrid = unit === 'grid';
    const spatialTable = isGrid ? 'spatial_grid_yunnan_stats' : 'spatial_county_yunnan_stats';
    const transferTable = isGrid ? 'spatial_grid_yunnan_transfer' : 'spatial_county_yunnan_transfer';

    const cols = await getTableColumns(spatialTable);

    // 智能识别核心字段名
    const nameCol = cols.find(c => ['地名', 'name_zh', '县级', 'name', 'region_name', 'NAME'].includes(c)) || cols[0];
    const geomCol = cols.find(c => ['geom', 'geometry', 'shape', 'the_geom'].includes(c)) || 'geom';
    const adcodeCol = cols.find(c => ['区划码', 'adcode', 'code', 'ADCODE'].includes(c)) || (isGrid ? null : cols.find(c => ['id', 'gid'].includes(c)));

    // 土地利用字段选择（直接从 clcd_county 表读取）
    const landUseSelect = 'c.cropland, c.forest, c.shrub, c.grassland, c.water, c.snow_ice, c.barren, c.impervious, c.wetland';

    // 转换时期逻辑 (CLCD 通常以 5-10 年为单位发布转移矩阵，或逐年)
    // 假设存在逐年转换，如 'y9091_11' 表示 1990 到 1991 的流转
    // 如果找不到特定年份，回退到时期
    const period = year >= 1985 && year < 1990 ? 'y8590' :
        `y${String(year % 100).padStart(2, '0')}${String((year + 1) % 100).padStart(2, '0')}`;

    const transferCols = await getTableColumns(transferTable);
    const validTransferCols = transferCols.filter(c => c.startsWith(`${period}_`));

    // 默认全量流转表达式：SUM(所有流向异类的列)
    const conversionExpr = validTransferCols.length > 0
        ? validTransferCols.filter(c => {
            const ft = c.split('_').pop();
            return ft[0] !== ft[1]; // 排除 11, 22 等同类平移
        }).map(c => `COALESCE(t.${quoteIdentifier(c)}, 0)`).join(' + ')
        : '0';

    // 总面积表达式 (优先使用 shape_area)
    const totalAreaExpr = cols.includes('shape_area') ? 's.shape_area' : '1.0';

    // JOIN 条件
    const clcdJoin = `TRIM(CAST(s.${quoteIdentifier(nameCol)} AS TEXT)) = TRIM(c.region_name) AND c.year = $1`;
    const transferJoin = `TRIM(CAST(s.${quoteIdentifier(nameCol)} AS TEXT)) = TRIM(CAST(t.${quoteIdentifier(nameCol)} AS TEXT))`;

    return {
        unit,
        year,
        spatialTable,
        transferTable,
        nameCol,
        geomCol,
        adcodeCol,
        landUseSelect,
        conversionExpr,
        totalAreaExpr,
        clcdJoin,
        transferJoin,
        conversionPeriod: period,
        hasStatsInSpatial: false // 统计数据在 clcd_county 表中
    };
}
