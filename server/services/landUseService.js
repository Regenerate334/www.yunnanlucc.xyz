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
import { getAvailablePeriods, findOverlappingPeriods, sortPeriods } from '../utils/period_encoder.js';

const MONITORING_POLICY_PROFILES = {
    farmland_protection: {
        name: 'farmland_protection',
        label: '耕地保护优先',
        cropland_floor_ratio: 1.0,
        cropland_sensitivity: 0.05,
        cropland_decline_sensitivity: 0.015,
        cropland_stock_weight: 0.65,
        cropland_flow_weight: 0.35,
        eco_floor_ratio: 0.95,
        urban_strategy: 'control',
        urban_target_multiplier: 1.08,
        urban_share_tolerance: 0.025,
        urban_intensity_target: 0.10,
        urban_intensity_band: 0.10,
        subsystem_weights: { production: 0.50, living: 0.20, ecological: 0.30 },
        composite_weights: { core: 0.50, redline: 0.25, urban: 0.10, coupling: 0.15 }
    },
    balanced: {
        name: 'balanced',
        label: '均衡协同',
        cropland_floor_ratio: 0.97,
        cropland_sensitivity: 0.07,
        cropland_decline_sensitivity: 0.020,
        cropland_stock_weight: 0.55,
        cropland_flow_weight: 0.45,
        eco_floor_ratio: 0.97,
        urban_strategy: 'balanced',
        urban_target_multiplier: 1.20,
        urban_share_tolerance: 0.035,
        urban_intensity_target: 0.18,
        urban_intensity_band: 0.12,
        subsystem_weights: { production: 0.34, living: 0.33, ecological: 0.33 },
        composite_weights: { core: 0.55, redline: 0.15, urban: 0.15, coupling: 0.15 }
    },
    ecological_protection: {
        name: 'ecological_protection',
        label: '生态保护优先',
        cropland_floor_ratio: 0.92,
        cropland_sensitivity: 0.09,
        cropland_decline_sensitivity: 0.025,
        cropland_stock_weight: 0.45,
        cropland_flow_weight: 0.55,
        eco_floor_ratio: 1.00,
        urban_strategy: 'control',
        urban_target_multiplier: 1.10,
        urban_share_tolerance: 0.025,
        urban_intensity_target: 0.12,
        urban_intensity_band: 0.10,
        subsystem_weights: { production: 0.25, living: 0.20, ecological: 0.55 },
        composite_weights: { core: 0.55, redline: 0.10, urban: 0.10, coupling: 0.25 }
    },
    urban_development: {
        name: 'urban_development',
        label: '城镇发展优先',
        cropland_floor_ratio: 0.90,
        cropland_sensitivity: 0.10,
        cropland_decline_sensitivity: 0.030,
        cropland_stock_weight: 0.40,
        cropland_flow_weight: 0.60,
        eco_floor_ratio: 0.92,
        urban_strategy: 'encourage',
        urban_target_multiplier: 1.40,
        urban_share_tolerance: 0.040,
        urban_intensity_target: 0.30,
        urban_intensity_band: 0.16,
        subsystem_weights: { production: 0.25, living: 0.45, ecological: 0.30 },
        composite_weights: { core: 0.55, redline: 0.10, urban: 0.20, coupling: 0.15 }
    },
    reforestation: {
        name: 'reforestation',
        label: '退耕还林导向',
        cropland_floor_ratio: 0.88,
        cropland_sensitivity: 0.12,
        cropland_decline_sensitivity: 0.035,
        cropland_stock_weight: 0.35,
        cropland_flow_weight: 0.65,
        eco_floor_ratio: 1.03,
        urban_strategy: 'control',
        urban_target_multiplier: 1.10,
        urban_share_tolerance: 0.025,
        urban_intensity_target: 0.10,
        urban_intensity_band: 0.10,
        subsystem_weights: { production: 0.25, living: 0.20, ecological: 0.55 },
        composite_weights: { core: 0.50, redline: 0.10, urban: 0.10, coupling: 0.30 }
    }
};

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
        if (!name) return 'province';
        const trimmed = String(name).trim();
        if (!trimmed || trimmed === '云南省' || trimmed === '全省') return 'province';
        const clean = trimmed.replace(/市|县|区|自治州|省/g, '').trim();
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
        // Normalize region: avoid accidental whitespace or "全省/云南省" variants causing
        // empty WHERE filters (which would turn SUM(...) into all NULLs).
        const normalizedRegion = typeof region === 'string' ? region.trim() : region;
        const isProvinceScope = !normalizedRegion || normalizedRegion === '云南省' || normalizedRegion === '全省';

        // 先探测字段
        const { rows: colRows } = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'spatial_county_yunnan_transfer' AND column_name LIKE $1
        `, [`${period}_%`]);

        if (colRows.length === 0) return [];

        let actualLevel = level;
        if (actualLevel === 'auto' || !actualLevel) {
            actualLevel = this._inferLevel(normalizedRegion);
        }

        let whereClause = '';
        let params = [];
        if (!isProvinceScope) {
            const fuzzy = this._getFuzzyName(normalizedRegion, actualLevel);
            whereClause = `WHERE TRIM("地名") LIKE $1 OR TRIM("地级") LIKE $1`;
            params.push(fuzzy);
        }

        const selectClaims = colRows.map(c => `SUM("${c.column_name}") as "${c.column_name}"`).join(', ');
        const sql = `SELECT ${selectClaims} FROM spatial_county_yunnan_transfer ${whereClause}`;
        const { rows: dataRows } = await pool.query(sql, params);

        return dataRows[0] || {};
    }

    /**
     * 获取土地转移矩阵（按年份区间聚合）
     * 使用数据库真实存在的 period 列进行多段求和，避免 yYYZZ 聚合列不存在导致空结果。
     *
     * 说明：transfer 宽表的列形如 `${period}_${from}${to}`，period 并非覆盖所有组合。
     */
    async getTransferMatrixByYearRange(region, yearStart, yearEnd, level = 'auto') {
        const normalizedRegion = typeof region === 'string' ? region.trim() : region;
        const isProvinceScope = !normalizedRegion || normalizedRegion === '云南省' || normalizedRegion === '全省';

        const start = Number.parseInt(yearStart, 10);
        const end = Number.parseInt(yearEnd, 10);
        if (!Number.isInteger(start) || !Number.isInteger(end) || start >= end) return {};

        const tableName = 'spatial_county_yunnan_transfer';
        const allPeriods = await getAvailablePeriods(pool, tableName);
        const periods = sortPeriods(findOverlappingPeriods(allPeriods, start, end));
        if (!periods.length) return {};

        const allCols = [];
        for (const p of periods) {
            const { rows } = await pool.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name = $1 AND column_name LIKE $2
            `, [tableName, `${p}_%`]);
            rows.forEach((r) => { if (r.column_name) allCols.push(r.column_name); });
        }
        const uniqueCols = Array.from(new Set(allCols));
        if (!uniqueCols.length) return {};

        let actualLevel = level;
        if (actualLevel === 'auto' || !actualLevel) {
            actualLevel = this._inferLevel(normalizedRegion);
        }

        let whereClause = '';
        const params = [];
        if (!isProvinceScope) {
            const fuzzy = this._getFuzzyName(normalizedRegion, actualLevel);
            whereClause = `WHERE TRIM("地名") LIKE $1 OR TRIM("地级") LIKE $1`;
            params.push(fuzzy);
        }

        const selectClaims = uniqueCols.map(c => `SUM("${c}") as "${c}"`).join(', ');
        const sql = `SELECT ${selectClaims} FROM spatial_county_yunnan_transfer ${whereClause}`;
        const { rows: dataRows } = await pool.query(sql, params);
        const raw = dataRows[0] || {};

        // 聚合归一：将多 period 同一方向的值合并到 `${from}${to}` 键上，
        // 避免上层工具/模型需要理解 period 维度。
        const matrix = {};
        Object.entries(raw).forEach(([k, v]) => {
            const m = String(k).match(/_(\d)(\d)$/);
            if (!m) return;
            const key = `${m[1]}${m[2]}`;
            matrix[key] = (Number(matrix[key]) || 0) + (Number(v) || 0);
        });
        return matrix;
    }
    _calcMonitoringRaw(data) {
        if (!data) return null;

        const toKm2 = (val) => Number(val || 0) / 1000000;
        const area = {
            cropland: toKm2(data.cropland),
            forest: toKm2(data.forest),
            shrub: toKm2(data.shrub),
            grassland: toKm2(data.grassland),
            water: toKm2(data.water),
            wetland: toKm2(data.wetland),
            impervious: toKm2(data.impervious),
            barren: toKm2(data.barren),
            snow_ice: toKm2(data.snow_ice)
        };

        const totalArea = Object.values(area).reduce((sum, val) => sum + val, 0);
        if (totalArea <= 0) return null;
        const ecoArea = area.forest + area.shrub + area.grassland + area.water + area.wetland;
        const share = {
            cropland: area.cropland / totalArea,
            impervious: area.impervious / totalArea,
            ecological: ecoArea / totalArea
        };

        // HJ 192-2015 生境质量相关权重（按 CLCD 类别映射）
        const hqWeights = {
            cropland: 0.11,
            forest: 0.35,
            shrub: 0.35,
            grassland: 0.21,
            water: 0.28,
            wetland: 0.28,
            impervious: 0.04,
            barren: 0.01,
            snow_ice: 0.01
        };
        const hqVal = (Object.entries(hqWeights).reduce((sum, [k, w]) => sum + area[k] * w, 0) / totalArea) * 100;

        // 土地利用碳压代理：直接碳源/碳汇比值，并叠加建设用地占比压力项
        const carbonSource = area.cropland * 0.422;
        const carbonSink =
            (area.forest + area.shrub) * 0.612 +
            area.grassland * 0.021 +
            (area.water + area.wetland) * 0.235 +
            (area.barren + area.snow_ice) * 0.005;
        const urbanPressureFactor = 1 + (area.impervious / totalArea);
        const cmpVal = (carbonSource / Math.max(carbonSink, 1e-6)) * urbanPressureFactor;

        // 土地利用韧性代理：基于文献系数的面积加权平均
        const resilienceWeights = {
            cropland: 0.5,
            forest: 0.9,
            shrub: 0.8,
            grassland: 0.7,
            water: 0.8,
            wetland: 0.8,
            impervious: 0.2,
            barren: 0.1,
            snow_ice: 0.1
        };
        const eresVal = (Object.entries(resilienceWeights).reduce((sum, [k, w]) => sum + area[k] * w, 0) / totalArea) * 100;

        // 三生空间压力比代理：生活+生产空间对生态空间的挤压程度
        const lifeSpace = area.impervious;
        const prodSpace = area.cropland;
        const plecVal = (lifeSpace * 2 + prodSpace) / Math.max(ecoArea, 1e-6);

        return {
            hq: hqVal,
            cmp: cmpVal,
            eres: eresVal,
            plec: plecVal,
            area,
            totalArea,
            share
        };
    }

    _clamp(val, min = 0, max = 1) {
        return Math.max(min, Math.min(max, Number.isFinite(val) ? val : min));
    }

    _resolveMonitoringPolicy(policyName) {
        if (!policyName || typeof policyName !== 'string') {
            return MONITORING_POLICY_PROFILES.farmland_protection;
        }
        const key = policyName.trim().toLowerCase();
        return MONITORING_POLICY_PROFILES[key] || MONITORING_POLICY_PROFILES.farmland_protection;
    }

    _safeNormalizeWeights(weights, fallback) {
        const entries = Object.entries(weights || {});
        const sum = entries.reduce((s, [, v]) => s + (Number(v) || 0), 0);
        if (!Number.isFinite(sum) || sum <= 1e-9) return fallback;
        const normalized = {};
        entries.forEach(([k, v]) => {
            normalized[k] = (Number(v) || 0) / sum;
        });
        return normalized;
    }

    _calcPolicyRisk(rawCurrent, rawBase, rawPrev, profile, currentYear, prevYear) {
        const targetCropland = rawBase.area.cropland * profile.cropland_floor_ratio;
        const croplandGapRatio = (targetCropland - rawCurrent.area.cropland) / Math.max(targetCropland, 1e-9);
        const stockRisk = this._clamp(
            (Math.max(0, croplandGapRatio) / Math.max(profile.cropland_sensitivity, 1e-6)) * 100,
            0,
            100
        );

        const croplandYoY = (rawCurrent.area.cropland - rawPrev.area.cropland) / Math.max(rawPrev.area.cropland, 1e-9);
        const croplandDeclineRatio = Math.max(0, -croplandYoY);
        const flowRisk = this._clamp(
            (croplandDeclineRatio / Math.max(profile.cropland_decline_sensitivity, 1e-6)) * 100,
            0,
            100
        );
        const redlineRiskWeight = this._safeNormalizeWeights(
            {
                stock: Number(profile.cropland_stock_weight || 0.6),
                flow: Number(profile.cropland_flow_weight || 0.4)
            },
            { stock: 0.6, flow: 0.4 }
        );
        const redlineRisk = this._clamp(
            redlineRiskWeight.stock * stockRisk + redlineRiskWeight.flow * flowRisk,
            0,
            100
        );
        const croplandCompliance = this._clamp(rawCurrent.area.cropland / Math.max(targetCropland, 1e-9), 0, 2);

        const deltaYears = Math.max(1, Number(currentYear) - Number(prevYear));
        const urbanIncrement = rawCurrent.area.impervious - rawPrev.area.impervious;
        const urbanIntensity = (urbanIncrement / Math.max(rawCurrent.totalArea, 1e-9) / deltaYears) * 100;
        const urbanTarget = Number(profile.urban_intensity_target || 0.15);
        const urbanBand = Math.max(Number(profile.urban_intensity_band || 0.1), 0.01);

        let urbanRisk = 0;
        if (profile.urban_strategy === 'control') {
            urbanRisk = ((urbanIntensity - urbanTarget) / urbanBand) * 100;
        } else if (profile.urban_strategy === 'encourage') {
            if (urbanIntensity <= urbanTarget) {
                urbanRisk = ((urbanTarget - urbanIntensity) / urbanBand) * 100;
            } else {
                urbanRisk = ((urbanIntensity - urbanTarget) / (urbanBand * 1.8)) * 100;
            }
        } else {
            urbanRisk = (Math.abs(urbanIntensity - urbanTarget) / urbanBand) * 100;
        }
        urbanRisk = this._clamp(urbanRisk, 0, 100);

        const croplandTargetShare = (rawBase.area.cropland * profile.cropland_floor_ratio) / Math.max(rawBase.totalArea, 1e-9);
        const ecologicalBaseArea = rawBase.area.forest + rawBase.area.shrub + rawBase.area.grassland + rawBase.area.water + rawBase.area.wetland;
        const ecologicalTargetShare = (ecologicalBaseArea * profile.eco_floor_ratio) / Math.max(rawBase.totalArea, 1e-9);
        const urbanTargetShare = this._clamp(rawBase.share.impervious * profile.urban_target_multiplier, 0, 1);
        const urbanShareTol = Math.max(Number(profile.urban_share_tolerance || 0.03), 1e-6);

        const production = this._clamp(rawCurrent.share.cropland / Math.max(croplandTargetShare, 1e-9), 0, 1);
        const ecological = this._clamp(rawCurrent.share.ecological / Math.max(ecologicalTargetShare, 1e-9), 0, 1);

        let living = 0;
        if (profile.urban_strategy === 'encourage') {
            living = this._clamp(rawCurrent.share.impervious / Math.max(urbanTargetShare, 1e-9), 0, 1);
        } else if (profile.urban_strategy === 'control') {
            const overflow = Math.max(0, rawCurrent.share.impervious - urbanTargetShare);
            living = this._clamp(1 - overflow / urbanShareTol, 0, 1);
        } else {
            living = this._clamp(1 - Math.abs(rawCurrent.share.impervious - urbanTargetShare) / urbanShareTol, 0, 1);
        }

        const subsystem = {
            production,
            living,
            ecological
        };
        const subsystemWeights = this._safeNormalizeWeights(
            profile.subsystem_weights,
            { production: 1 / 3, living: 1 / 3, ecological: 1 / 3 }
        );

        const avgSubsystem = (production + living + ecological) / 3;
        let coupling = 0;
        if (production > 0 && living > 0 && ecological > 0 && avgSubsystem > 1e-9) {
            const numerator = production * living * ecological;
            const denominator = Math.pow(avgSubsystem, 3);
            coupling = Math.pow(numerator / Math.max(denominator, 1e-9), 1 / 3);
        }
        coupling = this._clamp(coupling, 0, 1);

        const coordination =
            subsystemWeights.production * production +
            subsystemWeights.living * living +
            subsystemWeights.ecological * ecological;
        const couplingCoordination = this._clamp(Math.sqrt(coupling * coordination), 0, 1);
        const couplingRisk = this._clamp((1 - couplingCoordination) * 100, 0, 100);

        return {
            croplandRedline: {
                value: croplandCompliance,
                base: 1,
                score: redlineRisk,
                stock_score: stockRisk,
                flow_score: flowRisk,
                yoy_change_ratio: croplandYoY,
                target_area_km2: targetCropland,
                current_area_km2: rawCurrent.area.cropland
            },
            urbanExpansion: {
                value: urbanIntensity,
                base: urbanTarget,
                score: urbanRisk,
                strategy: profile.urban_strategy,
                prev_year: prevYear,
                delta_years: deltaYears
            },
            couplingCoordination: {
                value: couplingCoordination,
                base: 1,
                score: couplingRisk,
                coupling,
                coordination,
                subsystem,
                subsystem_weights: subsystemWeights
            }
        };
    }

    _calcRiskScoresBySeries(rawSeries, currentRaw) {
        const keys = ['hq', 'cmp', 'eres', 'plec'];
        const inverseRisk = new Set(['hq', 'eres']); // 数值越高越安全，需要反向映射为风险

        const ranges = {};
        keys.forEach((k) => {
            const col = rawSeries.map(r => Number(r[k] || 0));
            ranges[k] = {
                min: Math.min(...col),
                max: Math.max(...col)
            };
        });

        const normalize = (val, min, max, inverse = false) => {
            const diff = max - min;
            if (!Number.isFinite(diff) || diff <= 1e-9) return 0;
            let ratio = (val - min) / diff;
            ratio = Math.max(0, Math.min(1, ratio));
            if (inverse) ratio = 1 - ratio;
            return ratio * 100;
        };

        const currentScores = {};
        keys.forEach((k) => {
            currentScores[k] = normalize(
                Number(currentRaw[k] || 0),
                ranges[k].min,
                ranges[k].max,
                inverseRisk.has(k)
            );
        });

        const scoreSeries = rawSeries.map((row) => {
            const s = {};
            keys.forEach((k) => {
                s[k] = normalize(
                    Number(row[k] || 0),
                    ranges[k].min,
                    ranges[k].max,
                    inverseRisk.has(k)
                );
            });
            return s;
        });

        return { currentScores, scoreSeries };
    }

    _calcEntropyWeights(scoreSeries) {
        const keys = ['hq', 'cmp', 'eres', 'plec'];
        const n = scoreSeries.length;
        const fallback = { hq: 0.25, cmp: 0.25, eres: 0.25, plec: 0.25 };
        if (n < 2) return fallback;

        const k = 1 / Math.log(n);
        const entropy = {};
        const divergence = {};

        keys.forEach((key) => {
            const col = scoreSeries.map(r => Math.max(Number(r[key] || 0), 0) + 1e-12);
            const sumCol = col.reduce((s, v) => s + v, 0);
            if (sumCol <= 0) {
                entropy[key] = 1;
                divergence[key] = 0;
                return;
            }

            let e = 0;
            col.forEach((val) => {
                const p = val / sumCol;
                e += p * Math.log(p);
            });
            e = -k * e;
            entropy[key] = e;
            divergence[key] = Math.max(0, 1 - e);
        });

        const sumD = keys.reduce((s, key) => s + divergence[key], 0);
        if (!Number.isFinite(sumD) || sumD <= 1e-12) return fallback;

        const weights = {};
        keys.forEach((key) => {
            weights[key] = divergence[key] / sumD;
        });
        return weights;
    }

    /**
     * 监测算法（核验重构版）
     * - 单指标：文献系数 + 面积统计
     * - 综合指数：历史序列标准化 + 熵权法
     */
    _calculateMonitoringIndices(curr, base, seriesRows = [], options = {}) {
        if (!curr || !base) return null;

        const rawCurrent = this._calcMonitoringRaw(curr);
        const rawBase = this._calcMonitoringRaw(base);
        if (!rawCurrent || !rawBase) return null;

        const rawSeries = (Array.isArray(seriesRows) ? seriesRows : [])
            .map((row) => this._calcMonitoringRaw(row))
            .filter(Boolean);

        if (rawSeries.length === 0) {
            rawSeries.push(rawBase, rawCurrent);
        }

        const { currentScores, scoreSeries } = this._calcRiskScoresBySeries(rawSeries, rawCurrent);
        const weights = this._calcEntropyWeights(scoreSeries);
        const coreComposite = ['hq', 'cmp', 'eres', 'plec']
            .reduce((sum, key) => sum + (weights[key] || 0) * (currentScores[key] || 0), 0);

        const currentYear = Number(curr.year);
        const prevRow = (Array.isArray(seriesRows) ? seriesRows : [])
            .filter((row) => Number(row.year) < currentYear)
            .sort((a, b) => Number(b.year) - Number(a.year))[0];
        const prevData = prevRow || base;
        const prevYear = Number(prevData.year || base.year || currentYear - 1);
        const rawPrev = this._calcMonitoringRaw(prevData) || rawBase;

        const policyProfile = this._resolveMonitoringPolicy(options.policy);
        const policyMetrics = this._calcPolicyRisk(rawCurrent, rawBase, rawPrev, policyProfile, currentYear, prevYear);
        const compositeWeights = this._safeNormalizeWeights(
            policyProfile.composite_weights,
            { core: 0.6, redline: 0.2, urban: 0.1, coupling: 0.1 }
        );
        const finalComposite =
            compositeWeights.core * coreComposite +
            compositeWeights.redline * policyMetrics.croplandRedline.score +
            compositeWeights.urban * policyMetrics.urbanExpansion.score +
            compositeWeights.coupling * policyMetrics.couplingCoordination.score;

        return {
            year: curr.year,
            metrics: {
                hq: { value: rawCurrent.hq, base: rawBase.hq, score: currentScores.hq },
                cmp: { value: rawCurrent.cmp, base: rawBase.cmp, score: currentScores.cmp },
                eres: { value: rawCurrent.eres, base: rawBase.eres, score: currentScores.eres },
                plec: { value: rawCurrent.plec, base: rawBase.plec, score: currentScores.plec }
            },
            weights,
            weighting: { method: 'entropy', sample_size: scoreSeries.length },
            policy: {
                name: policyProfile.name,
                label: policyProfile.label
            },
            policyMetrics,
            compositeBreakdown: {
                core: Math.max(0, Math.min(100, coreComposite)),
                redline: policyMetrics.croplandRedline.score,
                urban: policyMetrics.urbanExpansion.score,
                coupling: policyMetrics.couplingCoordination.score,
                weights: compositeWeights
            },
            legacyCompositeScore: Math.max(0, Math.min(100, coreComposite)),
            compositeScore: Math.max(0, Math.min(100, finalComposite))
        };
    }

    /**
     * 获取指定区域和年份的监测指数
     */
    async getRegionMonitoring(year, region = '云南省', level = 'province', options = {}) {
        const baseYear = 1985;
        let seriesRows = [];
        let currentData = null;
        let baseData = null;

        if (level === 'province' || region === '云南省') {
            seriesRows = await this.getTrend('云南省', baseYear, year);
            currentData = seriesRows.find(r => Number(r.year) === Number(year)) || seriesRows[seriesRows.length - 1] || null;
            baseData = seriesRows.find(r => Number(r.year) === baseYear) || seriesRows[0] || currentData;
            region = '云南省';
            level = 'province';
        } else {
            seriesRows = await this.getTrend(region, baseYear, year, level);
            currentData = seriesRows.find(r => Number(r.year) === Number(year)) || seriesRows[seriesRows.length - 1] || null;
            baseData = seriesRows.find(r => Number(r.year) === baseYear) || seriesRows[0] || currentData;
        }

        if (!currentData || !baseData) return null;

        const result = this._calculateMonitoringIndices(currentData, baseData, seriesRows, options);
        if (!result) return null;
        return {
            ...result,
            region,
            level,
            baseYear
        };
    }
}

export default new LandUseService();
