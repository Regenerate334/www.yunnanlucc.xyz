/**
 * LandUseService.js — 土地利用业务逻辑层
 * 
 * 职责：
 * 1. 封装底层 SQL 查询，屏蔽数据库表结构细节。
 * 2. 提供供 API 控制器和 AI 工具调用的标准接口。
 * 3. 处理数据聚合与初步转换逻辑。
 */

import pool from '../config/db.js';
import { calculateDynamicDegree, calculateSingleDynamicDegree } from '../utils/indices/dynamicDegree.js';

class LandUseService {
    constructor() {
        // 常见地名简写映射，提升匹配率
        this.regionAliases = {
            '昆明': '昆明市', '曲靖': '曲靖市', '玉溪': '玉溪市', '保山': '保山市',
            '昭通': '昭通市', '丽江': '丽江市', '普洱': '普洱市', '临沧': '临沧市',
            '楚雄': '楚雄彝族自治州', '红河': '红河哈尼族彝族自治州',
            '文山': '文山壮族苗族自治州', '西双版纳': '西双版纳傣族自治州',
            '大理': '大理白族自治州', '德宏': '德宏傣族景颇族自治州',
            '怒江': '怒江傈僳族自治州', '迪庆': '迪庆藏族自治州'
        };
    }

    /**
     * 对地名进行模糊处理，返回 SQL 匹配参数
     * @param {string} name - 地名
     * @param {string} level - 级别 (province, prefecture, county)
     */
    _getFuzzyName(name, level = 'prefecture') {
        if (!name) return null;
        const clean = name.replace(/市|县|区|自治州|省/g, '').trim();
        // 只有地级市才应用映射逻辑（例如 “大理” -> “大理白族自治州”）
        // 县级市（如 “大理市”）应直接使用模糊匹配，避免被错误映射到地级州
        if ((level === 'prefecture' || level === 'auto') && this.regionAliases[clean]) {
            return this.regionAliases[clean];
        }
        return `%${clean}%`;
    }

    /**
     * 自动推断行政级别
     */
    _inferLevel(name) {
        if (!name || name === '云南省' || name === '全省') return 'province';
        const clean = name.replace(/市|县|区|自治州|省/g, '').trim();
        if (this.regionAliases[clean]) return 'prefecture';
        return 'county'; // 如果不是地州或省级，则默认降维到县级
    }

    /**
     * 获取仪表盘综合分析数据
     * @param {number} year - 目标年份
     * @param {string} type - 'comprehensive' 或特定地类
     * @param {string} region - 目标区域
     * @param {string} level - 行政级别
     */
    async getDashboardData(year, type = 'comprehensive', region = '云南省', level = 'auto') {
        const baseYear = 1985;
        const yearDiff = Math.abs(year - baseYear);

        let actualLevel = level;
        if (actualLevel === 'auto' || !actualLevel) {
            actualLevel = this._inferLevel(region);
        }

        // 1. 获取目标区域对比数据
        let currentRegionSummary, baseRegionSummary;
        if (actualLevel === 'province' || region === '云南省' || region === '全省') {
            currentRegionSummary = await this.getProvinceSummary(year);
            baseRegionSummary = await this.getProvinceSummary(baseYear);
            region = '云南省';
        } else {
            const currentRows = await this.getRegionData(year, region, actualLevel);
            const baseRows = await this.getRegionData(baseYear, region, actualLevel);
            currentRegionSummary = currentRows[0];
            baseRegionSummary = baseRows[0] || currentRows[0];
        }

        if (!currentRegionSummary || !baseRegionSummary) return null;

        // 2. 获取该区域内的下级排行 (如果是全省则取地州，如果是地州则取县级)
        let ranking = [];
        const nextLevel = actualLevel === 'province' ? 'prefecture' : 'county';
        const tableName = nextLevel === 'county' ? 'clcd_county' : 'clcd_prefecture';

        let subRegionFilter = '';
        let subRegionParams = [year, baseYear];
        if (actualLevel === 'prefecture') {
            const fuzzy = this._getFuzzyName(region, 'prefecture');
            subRegionFilter = ` AND p1.region_name LIKE $3 `; // In county table, region_name is the county, we need a parent field if exists?
            // Wait, in clcd_county table, there might not be a "parent" column. 
            // Let's check table schema.
        }

        // 简化排行：如果不是全省，暂时只返回该区域自己的数据作为“排行”第一项，或尝试匹配
        if (actualLevel === 'province') {
            const { rows: prefRows } = await pool.query(`
                SELECT p1.region_name, 
                       p1.cropland as c1, p1.forest as f1, p1.shrub as s1, p1.grassland as g1, 
                       p1.water as w1, p1.snow_ice as i1, p1.barren as b1, p1.impervious as m1, p1.wetland as t1,
                       p2.cropland as c2, p2.forest as f2, p2.shrub as s2, p2.grassland as g2, 
                       p2.water as w2, p2.snow_ice as i2, p2.barren as b2, p2.impervious as m2, p2.wetland as t2
                FROM public.clcd_prefecture p1
                JOIN public.clcd_prefecture p2 ON p1.region_name = p2.region_name
                WHERE p1.year = $1 AND p2.year = $2
            `, [year, baseYear]);

            ranking = prefRows.map(r => {
                let dynamicValue = 0;
                const start = { cropland: r.c2, forest: r.f2, shrub: r.s2, grassland: r.g2, water: r.w2, snow_ice: r.i2, barren: r.b2, impervious: r.m2, wetland: r.t2 };
                const end = { cropland: r.c1, forest: r.f1, shrub: r.s1, grassland: r.g1, water: r.w1, snow_ice: r.i1, barren: r.b1, impervious: r.m1, wetland: r.t1 };
                dynamicValue = calculateDynamicDegree(start, end, yearDiff);
                return {
                    name: r.region_name.replace(/市|自治州|地区/g, ''),
                    value: parseFloat(Math.abs(dynamicValue).toFixed(4))
                };
            }).sort((a, b) => b.value - a.value).slice(0, 10);
        }

        // 3. 构建预警
        const alerts = [];
        if (currentRegionSummary.cropland < baseRegionSummary.cropland * 0.95) {
            alerts.push({
                id: Date.now(),
                type: 'danger',
                title: '耕地红线预警',
                content: `当前${region}耕地较1985年减少超过5%，请注意生态补给。`
            });
        }

        // 4. 计算指标
        const ecoAreaCurrent = Number(currentRegionSummary.forest || 0) + Number(currentRegionSummary.shrub || 0) + Number(currentRegionSummary.grassland || 0) + Number(currentRegionSummary.water || 0) + Number(currentRegionSummary.wetland || 0);
        const ecoAreaBase = Number(baseRegionSummary.forest || 0) + Number(baseRegionSummary.shrub || 0) + Number(baseRegionSummary.grassland || 0) + Number(baseRegionSummary.water || 0) + Number(baseRegionSummary.wetland || 0);

        const compDynamic = calculateDynamicDegree(baseRegionSummary, currentRegionSummary, yearDiff);
        const urbanDynamic = calculateSingleDynamicDegree(baseRegionSummary.impervious || 0, currentRegionSummary.impervious || 0, yearDiff);
        const ecoDynamic = calculateSingleDynamicDegree(ecoAreaBase, ecoAreaCurrent, yearDiff);

        const csponMetrics = {
            croplandArea: {
                value: parseFloat((Number(currentRegionSummary.cropland || 0) / 1000000).toFixed(2)),
                trend: parseFloat(((Number(currentRegionSummary.cropland || 0) - Number(baseRegionSummary.cropland || 0)) / 1000000).toFixed(2))
            },
            urbanArea: {
                value: parseFloat((Number(currentRegionSummary.impervious || 0) / 1000000).toFixed(2)),
                trend: parseFloat(((Number(currentRegionSummary.impervious || 0) - Number(baseRegionSummary.impervious || 0)) / 1000000).toFixed(2))
            },
            ecoArea: {
                value: parseFloat((ecoAreaCurrent / 1000000).toFixed(2)),
                trend: parseFloat(((ecoAreaCurrent - ecoAreaBase) / 1000000).toFixed(2))
            },
            compDynamic: { value: parseFloat(compDynamic.toFixed(3)), trend: parseFloat(compDynamic.toFixed(3)) },
            urbanDynamic: { value: parseFloat(urbanDynamic.toFixed(3)), trend: parseFloat(urbanDynamic.toFixed(3)) },
            ecoDynamic: { value: parseFloat(ecoDynamic.toFixed(3)), trend: parseFloat(ecoDynamic.toFixed(3)) }
        };

        return {
            year,
            region,
            summary: currentRegionSummary,
            baseSummary: baseRegionSummary,
            ranking,
            alerts,
            csponMetrics
        };
    }
    /**
     * 获取所有可用的年份列表
     */
    async getAvailableYears() {
        const { rows } = await pool.query('SELECT DISTINCT year FROM clcd_province ORDER BY year');
        return rows.map(r => r.year);
    }

    // ── CLCD 核心数据查询 ───────────────────────────────────────────────────

    /**
     * 获取指定年份全省地类汇总
     */
    async getProvinceSummary(year) {
        const sql = `
            SELECT year,
                MAX(CASE WHEN LOWER(land_use_type)='cropland'  THEN area END) as cropland,
                MAX(CASE WHEN LOWER(land_use_type)='forest'    THEN area END) as forest,
                MAX(CASE WHEN LOWER(land_use_type)='shrub'     THEN area END) as shrub,
                MAX(CASE WHEN LOWER(land_use_type)='grassland' THEN area END) as grassland,
                MAX(CASE WHEN LOWER(land_use_type)='water'     THEN area END) as water,
                MAX(CASE WHEN LOWER(land_use_type)='wetland'   THEN area END) as wetland,
                MAX(CASE WHEN LOWER(land_use_type)='impervious'THEN area END) as impervious,
                MAX(CASE WHEN LOWER(land_use_type)='barren'    THEN area END) as barren,
                MAX(CASE WHEN LOWER(land_use_type)='snow_ice'  THEN area END) as snow_ice
            FROM clcd_province WHERE year = $1 GROUP BY year
        `;
        const { rows } = await pool.query(sql, [year]);
        return rows[0] || null;
    }

    /**
     * 获取市县数据（单年或对比）
     */
    async getRegionData(year, regions = null, level = 'auto') {
        // 如果未指定具体 level 并且是单一区域，进行自动推断
        let actualLevel = level;
        if (actualLevel === 'auto' || !actualLevel) {
            if (regions && !Array.isArray(regions)) {
                actualLevel = this._inferLevel(regions);
            } else if (regions && Array.isArray(regions) && regions.length > 0) {
                actualLevel = this._inferLevel(regions[0]); // 按第一个元素推断
            } else {
                actualLevel = 'prefecture'; // 默认全省各地州
            }
        }

        const tableName = actualLevel === 'county' ? 'clcd_county' : 'clcd_prefecture';
        let sql = `SELECT * FROM ${tableName} WHERE year = $1`;
        let params = [year];

        if (regions) {
            if (Array.isArray(regions)) {
                const fuzzyNames = regions.map(r => this._getFuzzyName(r, level));
                const placeholders = fuzzyNames.map((_, i) => `$${i + 2}`).join(', ');
                sql += ` AND region_name IN (${placeholders})`; // IN works better for known set than multiple LIKE if they are complete names
                // If fuzzy is needed:
                const likeClauses = fuzzyNames.map((_, i) => `region_name LIKE $${i + 2}`).join(' OR ');
                sql = `SELECT * FROM ${tableName} WHERE year = $1 AND (${likeClauses})`;
                params.push(...fuzzyNames);
            } else {
                const fuzzy = this._getFuzzyName(regions, level);
                sql += ` AND region_name LIKE $2`;
                params.push(fuzzy);
            }
        }

        const { rows } = await pool.query(sql, params);
        return rows;
    }

    /**
     * 获取历史趋势数据
     */
    async getTrend(region, startYear, endYear, level = 'auto') {
        if (!region || region === '云南省' || region === '全省') {
            const { rows } = await pool.query(`
                SELECT year,
                    MAX(CASE WHEN LOWER(land_use_type)='cropland'  THEN area END) as cropland,
                    MAX(CASE WHEN LOWER(land_use_type)='forest'    THEN area END) as forest,
                    MAX(CASE WHEN LOWER(land_use_type)='shrub'     THEN area END) as shrub,
                    MAX(CASE WHEN LOWER(land_use_type)='grassland' THEN area END) as grassland,
                    MAX(CASE WHEN LOWER(land_use_type)='water'     THEN area END) as water,
                    MAX(CASE WHEN LOWER(land_use_type)='wetland'   THEN area END) as wetland,
                    MAX(CASE WHEN LOWER(land_use_type)='impervious'THEN area END) as impervious,
                    MAX(CASE WHEN LOWER(land_use_type)='barren'    THEN area END) as barren,
                    MAX(CASE WHEN LOWER(land_use_type)='snow_ice'  THEN area END) as snow_ice
                FROM clcd_province 
                WHERE year BETWEEN $1 AND $2
                GROUP BY year ORDER BY year ASC
            `, [startYear, endYear]);
            return rows;
        } else {
            let actualLevel = level;
            if (actualLevel === 'auto' || !actualLevel) {
                actualLevel = this._inferLevel(region);
            }

            const tableName = actualLevel === 'county' ? 'clcd_county' : 'clcd_prefecture';
            const fuzzy = this._getFuzzyName(region, actualLevel);
            const { rows } = await pool.query(`
                SELECT * FROM ${tableName} 
                WHERE region_name LIKE $1
                  AND year BETWEEN $2 AND $3
                ORDER BY year ASC
            `, [fuzzy, startYear, endYear]);
            return rows;
        }
    }

    // ── 土地流转业务查询 ────────────────────────────────────────────────────

    /**
     * 获取土地转移矩阵
     */
    async getTransferMatrix(region, period, level = 'auto') {
        // 先探测字段
        const { rows: colRows } = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'spatial_county_yunnan_transfer' AND column_name LIKE $1
        `, [`${period}_%`]);

        if (colRows.length === 0) return [];

        let actualLevel = level;
        if (actualLevel === 'auto' || !actualLevel) {
            actualLevel = this._inferLevel(region);
        }

        let whereClause = '';
        let params = [];
        if (region && region !== '云南省') {
            const fuzzy = this._getFuzzyName(region, actualLevel);
            whereClause = `WHERE TRIM("地名") LIKE $1 OR TRIM("地级") LIKE $1`;
            params.push(fuzzy);
        }

        const selectClaims = colRows.map(c => `SUM("${c.column_name}") as "${c.column_name}"`).join(', ');
        const sql = `SELECT ${selectClaims} FROM spatial_county_yunnan_transfer ${whereClause}`;
        const { rows: dataRows } = await pool.query(sql, params);

        return dataRows[0] || {};
    }
    /**
     * 计算 2021-2026 范式的权威监测算法
     * 依据：docs/LUCC_Algorithms_2021_2026.md
     */
    _calculateMonitoringIndices(curr, base) {
        if (!curr || !base) return null;

        const norm = (val) => Number(val || 0) / 1000000; // 转化为 km2
        const landTypes = ['cropland', 'forest', 'shrub', 'grassland', 'water', 'wetland', 'impervious', 'barren', 'snow_ice'];

        let totalArea = 0, totalBaseArea = 0;
        landTypes.forEach(t => {
            totalArea += norm(curr[t]);
            totalBaseArea += norm(base[t]);
        });
        if (totalArea <= 0 || totalBaseArea <= 0) return null;

        /**
         * 1. InVEST生境质量 (HQI)
         * 权重：Forest/Wetland: 1.0, Water: 0.9, Shrub: 0.8, Grass: 0.7, Cropland: 0.3, Barren/Snow: 0.1
         */
        const hqWeights = { forest: 1.0, wetland: 1.0, water: 0.9, shrub: 0.8, grassland: 0.7, cropland: 0.3, barren: 0.1, snow_ice: 0.1, impervious: 0 };
        let hqSum = 0, hqBaseSum = 0;
        landTypes.forEach(t => {
            hqSum += norm(curr[t]) * hqWeights[t];
            hqBaseSum += norm(base[t]) * hqWeights[t];
        });
        const hqVal = (hqSum / totalArea) * 100;
        const hqBase = (hqBaseSum / totalBaseArea) * 100;

        /**
         * 2. 源汇碳代谢压力 (CMPI)
         * 源：Impervious: 50, Cropland: 0.42
         * 汇：Forest: 0.58, Shrub: 0.20, Water/Wetland: 0.25, Grass: 0.02
         */
        const calcCMP = (data) => {
            const emissions = norm(data.impervious) * 50 + norm(data.cropland) * 0.42;
            const sinks = norm(data.forest) * 0.58 + norm(data.shrub) * 0.20 + (norm(data.water) + norm(data.wetland)) * 0.25 + norm(data.grassland) * 0.02;
            return emissions / (sinks || 0.001);
        };
        const cmpVal = calcCMP(curr);
        const cmpBase = calcCMP(base);

        /**
         * 3. 生态韧性度 (ERes)
         * 权重：Forest: 1.0, Wetland: 0.9, Water: 0.8, Shrub/Grass: 0.7, Cropland: 0.4, Barren/Snow: 0.1
         */
        const resWeights = { forest: 1.0, wetland: 0.9, water: 0.8, shrub: 0.7, grassland: 0.7, cropland: 0.4, barren: 0.1, snow_ice: 0.1, impervious: 0 };
        let eResSum = 0, eResBaseSum = 0;
        landTypes.forEach(t => {
            eResSum += norm(curr[t]) * resWeights[t];
            eResBaseSum += norm(base[t]) * resWeights[t];
        });
        const eresVal = (eResSum / totalArea) * 100;
        const eresBase = (eResBaseSum / totalBaseArea) * 100;

        /**
         * 4. 三生空间冲突度 (PLEC)
         * 公式：(Life * 2 + Prod * 1) / Eco
         */
        const calcPLEC = (data) => {
            const aProd = norm(data.cropland);
            const aLife = norm(data.impervious);
            // 修正：生态空间仅包含绿/蓝空间（林、灌、草、水、湿），剔除裸地与冰雪以防数值稀释
            const aEco = norm(data.forest) + norm(data.shrub) + norm(data.grassland) + norm(data.water) + norm(data.wetland);
            return (aLife * 2.0 + aProd * 1.0) / (aEco || 0.001);
        };
        const plecVal = calcPLEC(curr);
        const plecBase = calcPLEC(base);

        // 统一预警级别判定逻辑
        const getScore = (val, breaks, ascending = true) => {
            const [b1, b2, b3] = breaks;
            if (ascending) {
                if (val <= b1) return (val / b1) * 25;
                if (val <= b2) return 25 + ((val - b1) / (b2 - b1)) * 25;
                if (val <= b3) return 50 + ((val - b2) / (b3 - b2)) * 25;
                return 75 + ((val - b3) / b3) * 25;
            } else {
                if (val >= b1) return ((Math.max(b1 * 1.1, val) - val) / (Math.max(b1 * 1.1, val) - b1 + 0.001)) * 25;
                if (val >= b2) return 25 + ((b1 - val) / (b1 - b2)) * 25;
                if (val >= b3) return 50 + ((b2 - val) / (b2 - b3)) * 25;
                return 75 + ((b3 - val) / b3) * 25;
            }
        };

        const scores = {
            hq: getScore(hqVal, [hqBase - 0.5, hqBase - 2.0, hqBase - 5.0], false),
            cmp: getScore(cmpVal, [cmpBase + 0.05, cmpBase + 0.20, cmpBase + 0.50], true),
            eres: getScore(eresVal, [eresBase - 0.5, eresBase - 2.0, eresBase - 5.0], false),
            plec: getScore(plecVal, [plecBase + 0.02, plecBase + 0.08, plecBase + 0.20], true)
        };

        // 综合加权引擎 (MCE Weighting Strategy)
        const weightedSum = scores.hq * 0.30 + scores.cmp * 0.25 + scores.eres * 0.25 + scores.plec * 0.20;
        const maxRisk = Math.max(...Object.values(scores));
        const compositeScore = weightedSum * 0.60 + maxRisk * 0.40;

        return {
            year: curr.year,
            metrics: {
                hq: { value: hqVal, base: hqBase, score: scores.hq },
                cmp: { value: cmpVal, base: cmpBase, score: scores.cmp },
                eres: { value: eresVal, base: eresBase, score: scores.eres },
                plec: { value: plecVal, base: plecBase, score: scores.plec }
            },
            compositeScore: Math.min(100, Math.max(0, compositeScore))
        };
    }

    /**
     * 获取指定区域和年份的监测指数
     */
    async getRegionMonitoring(year, region = '云南省', level = 'province') {
        const baseYear = 1985;
        let currentData, baseData;

        if (level === 'province' || region === '云南省') {
            currentData = await this.getProvinceSummary(year);
            baseData = await this.getProvinceSummary(baseYear);
        } else {
            const currentRows = await this.getTrend(region, year, year, level);
            const baseRows = await this.getTrend(region, baseYear, baseYear, level);
            currentData = currentRows[0];
            baseData = baseRows[0] || currentRows[0]; // 兜底处理
        }

        return this._calculateMonitoringIndices(currentData, baseData);
    }
}

export default new LandUseService();
