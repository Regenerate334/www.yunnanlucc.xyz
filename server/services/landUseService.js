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
        if (level === 'prefecture' && this.regionAliases[clean]) {
            return this.regionAliases[clean];
        }
        return `%${clean}%`;
    }

    /**
     * 获取仪表盘综合分析数据
     */
    async getDashboardData(year, type = 'comprehensive') {
        const baseYear = 1985;
        const yearDiff = Math.abs(year - baseYear);

        // 1. 获取全省对比数据
        const currentProvince = await this.getProvinceSummary(year);
        const baseProvince = await this.getProvinceSummary(baseYear);

        if (!currentProvince || !baseProvince) return null;

        // 2. 获取地级市排行
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

        const ranking = prefRows.map(r => {
            let dynamicValue = 0;
            if (type === 'comprehensive') {
                const start = { cropland: r.c2, forest: r.f2, shrub: r.s2, grassland: r.g2, water: r.w2, snow_ice: r.i2, barren: r.b2, impervious: r.m2, wetland: r.t2 };
                const end = { cropland: r.c1, forest: r.f1, shrub: r.s1, grassland: r.g1, water: r.w1, snow_ice: r.i1, barren: r.b1, impervious: r.m1, wetland: r.t1 };
                dynamicValue = calculateDynamicDegree(start, end, yearDiff);
            } else {
                const typeMap = { cropland: 'c', forest: 'f', grassland: 'g', impervious: 'm', water: 'w' };
                const alias = typeMap[type] || 'c';
                dynamicValue = calculateSingleDynamicDegree(Number(r[alias + '2']), Number(r[alias + '1']), yearDiff);
            }
            return {
                name: r.region_name.replace(/市|自治州|地区/g, ''),
                value: parseFloat(Math.abs(dynamicValue).toFixed(4))
            };
        }).sort((a, b) => b.value - a.value).slice(0, 10);

        // 3. 构建预警
        const alerts = [];
        if (currentProvince.cropland < baseProvince.cropland * 0.95) {
            alerts.push({
                id: Date.now(),
                type: 'danger',
                title: '耕地红线预警',
                content: `当前全省耕地较1985年减少超过5%，请注意生态补给。`
            });
        }

        // 4. 计算基于 CLCD 的专属 LUCC 指标
        const ecoAreaCurrent = Number(currentProvince.forest || 0) + Number(currentProvince.shrub || 0) + Number(currentProvince.grassland || 0) + Number(currentProvince.water || 0) + Number(currentProvince.wetland || 0);
        const ecoAreaBase = Number(baseProvince.forest || 0) + Number(baseProvince.shrub || 0) + Number(baseProvince.grassland || 0) + Number(baseProvince.water || 0) + Number(baseProvince.wetland || 0);

        const compDynamic = calculateDynamicDegree(baseProvince, currentProvince, yearDiff);
        const urbanDynamic = calculateSingleDynamicDegree(baseProvince.impervious || 0, currentProvince.impervious || 0, yearDiff);
        const ecoDynamic = calculateSingleDynamicDegree(ecoAreaBase, ecoAreaCurrent, yearDiff);

        // 格式化输出: 全领域统一单位 -> 平方公里(km2) = 原始面积(m2) / 1000000
        const csponMetrics = {
            croplandArea: {
                value: parseFloat((Number(currentProvince.cropland || 0) / 1000000).toFixed(2)),
                trend: parseFloat(((Number(currentProvince.cropland || 0) - Number(baseProvince.cropland || 0)) / 1000000).toFixed(2))
            },
            urbanArea: {
                value: parseFloat((Number(currentProvince.impervious || 0) / 1000000).toFixed(2)),
                trend: parseFloat(((Number(currentProvince.impervious || 0) - Number(baseProvince.impervious || 0)) / 1000000).toFixed(2))
            },
            ecoArea: {
                value: parseFloat((ecoAreaCurrent / 1000000).toFixed(2)),
                trend: parseFloat(((ecoAreaCurrent - ecoAreaBase) / 1000000).toFixed(2))
            },
            compDynamic: {
                value: parseFloat(compDynamic.toFixed(3)),
                trend: parseFloat(compDynamic.toFixed(3)) // 动态度本身就是变化率，这里 trend 可作为强调
            },
            urbanDynamic: {
                value: parseFloat(urbanDynamic.toFixed(3)),
                trend: parseFloat(urbanDynamic.toFixed(3))
            },
            ecoDynamic: {
                value: parseFloat(ecoDynamic.toFixed(3)),
                trend: parseFloat(ecoDynamic.toFixed(3))
            }
        };

        return {
            year,
            summary: currentProvince,
            baseSummary: baseProvince,
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
     * 获取地级市数据（单年或对比）
     */
    async getPrefectureData(year, regions = null) {
        let sql = `SELECT * FROM clcd_prefecture WHERE year = $1`;
        let params = [year];

        if (regions) {
            if (Array.isArray(regions)) {
                const fuzzyNames = regions.map(r => this._getFuzzyName(r, 'prefecture'));
                const placeholders = fuzzyNames.map((_, i) => `$${i + 2}`).join(', ');
                sql += ` AND region_name IN (${placeholders})`; // IN works better for known set than multiple LIKE if they are complete names
                // If fuzzy is needed:
                const likeClauses = fuzzyNames.map((_, i) => `region_name LIKE $${i + 2}`).join(' OR ');
                sql = `SELECT * FROM clcd_prefecture WHERE year = $1 AND (${likeClauses})`;
                params.push(...fuzzyNames);
            } else {
                const fuzzy = this._getFuzzyName(regions, 'prefecture');
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
    async getTrend(region, startYear, endYear, level = 'prefecture') {
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
            const tableName = level === 'county' ? 'clcd_county' : 'clcd_prefecture';
            const fuzzy = this._getFuzzyName(region, level);
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
    async getTransferMatrix(region, period) {
        // 先探测字段
        const { rows: colRows } = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'spatial_county_yunnan_transfer' AND column_name LIKE $1
        `, [`${period}_%`]);

        if (colRows.length === 0) return [];

        let whereClause = '';
        let params = [];
        if (region && region !== '云南省') {
            // 转移矩阵通常基于县级或地级，这里尝试不带 level 限制或作为模糊匹配
            const fuzzy = this._getFuzzyName(region, 'county');
            whereClause = `WHERE TRIM("地名") LIKE $1 OR TRIM("地级") LIKE $1`;
            params.push(fuzzy);
        }

        const selectClaims = colRows.map(c => `SUM("${c.column_name}") as "${c.column_name}"`).join(', ');
        const sql = `SELECT ${selectClaims} FROM spatial_county_yunnan_transfer ${whereClause}`;
        const { rows: dataRows } = await pool.query(sql, params);

        return dataRows[0] || {};
    }
}

export default new LandUseService();
