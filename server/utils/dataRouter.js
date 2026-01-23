import pool from '../config/db.js';

const PREFECTURES = {
    '昆明': '昆明市', '曲靖': '曲靖市', '玉溪': '玉溪市',
    '保山': '保山市', '昭通': '昭通市', '丽江': '丽江市',
    '普洱': '普洱市', '临沧': '临沧市',
    '楚雄': '楚雄彝族自治州', '红河': '红河哈尼族彝族自治州',
    '文山': '文山壮族苗族自治州', '西双版纳': '西双版纳傣族自治州',
    '大理': '大理白族自治州', '德宏': '德宏傣族景颇族自治州',
    '怒江': '怒江傈僳族自治州', '迪庆': '迪庆藏族自治州'
};

const LAND_USE_CONFIG = {
    cropland: '耕地',
    forest: '林地',
    shrub: '灌木',
    grassland: '草地',
    water: '水体',
    wetland: '湿地',
    impervious: '建设用地',
    barren: '裸地',
    snow_ice: '冰雪'
};

const LAND_TYPES = {
    '耕地': 'cropland', '林地': 'forest', '草地': 'grassland',
    '水体': 'water', '水域': 'water', '建设用地': 'impervious',
    '城市': 'impervious', '湿地': 'wetland', '裸地': 'barren',
    '灌木': 'shrub', '灌丛': 'shrub', '冰雪': 'snow_ice'
};

export class EntityExtractor {
    extract(question) {
        if (!question) return { prefectures: [], landTypes: [], years: [], queryType: 'general' };
        return {
            prefectures: this.extractPrefectures(question),
            landTypes: this.extractLandTypes(question),
            years: this.extractYears(question),
            queryType: this.classifyQuery(question)
        };
    }

    extractPrefectures(q) {
        const found = [];
        for (const [short, full] of Object.entries(PREFECTURES)) {
            if (q.includes(short) || q.includes(full)) {
                found.push(full);
            }
        }
        return found;
    }

    extractLandTypes(q) {
        const found = [];
        for (const [cn, en] of Object.entries(LAND_TYPES)) {
            if (q.includes(cn)) {
                if (!found.find(f => f.en === en)) {
                    found.push({ cn, en });
                }
            }
        }
        return found;
    }

    extractYears(q) {
        const matches = q.match(/\b(19[89]\d|20[0-2]\d)\b/g);
        return matches ? [...new Set(matches.map(Number))] : [];
    }

    classifyQuery(q) {
        if (q.includes('对比') || q.includes('比较')) return 'comparison';
        if (q.includes('趋势') || q.includes('变化') || q.includes('历史')) return 'trend';
        if (q.includes('排名') || q.includes('最大') || q.includes('最小')) return 'ranking';
        if (q.includes('结构') || q.includes('占比') || q.includes('分布')) return 'structure';
        return 'general';
    }
}

export class ContextBuilder {
    build(data, entities, componentContext) {
        if (!data || !data.rows || data.rows.length === 0) return '';

        let context = `## 地理空间分析上下文\n\n`;

        if (componentContext?.type === 'province_trend') {
            context += `> 数据来源: 云南省1985-2023年土地利用变化监测数据\n\n`;
        } else if (data.region) {
            context += `> 区域: ${data.region}\n\n`;
        }

        // 不再过滤，返回所有数据
        const allRows = data.rows;

        if (data.type === 'trend') {
            context += this.buildTrendTable(allRows);
        } else if (data.type === 'comparison') {
            context += this.buildComparisonTable(allRows);
        } else {
            context += this.buildStructureTable(allRows);
        }


        return context;
    }

    // 格式化数值：转为 km²，保留2位小数，千分位分隔
    formatNumber(val) {
        const num = (Number(val) || 0) / 1e6;
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    buildTrendTable(rows) {
        // 始终返回所有地9种地类数据
        const columns = Object.keys(LAND_USE_CONFIG);

        let table = `### 历史趋势数据 (1985-2023)\n\n`;

        // 表头统一使用 km²
        const headerCells = ['年份', ...columns.map(c => `${this.translateColumn(c)}<br>(km² - 禁止转换)`)];

        table += `| ${headerCells.join(' | ')} |\n`;
        table += `|${headerCells.map(() => '---').join('|')}|\n`;

        rows.forEach(r => {
            const values = columns.map(c => this.formatNumber(r[c]));
            table += `| ${r.year} | ${values.join(' | ')} |\n`;
        });

        return table;
    }

    buildComparisonTable(rows) {
        // 始终返回所有地9种地类数据
        const columns = Object.keys(LAND_USE_CONFIG);

        let table = `### 区域对比数据\n\n`;

        // 表头统一使用 km²
        const headerCells = ['地区', ...columns.map(c => `${this.translateColumn(c)}<br>(km² - 禁止转换)`)];

        table += `| ${headerCells.join(' | ')} |\n`;
        table += `|${headerCells.map(() => '---').join('|')}|\n`;

        rows.forEach(r => {
            const values = columns.map(c => this.formatNumber(r[c]));
            table += `| ${r.region_name || '未知'} | ${values.join(' | ')} |\n`;
        });

        return table;
    }

    buildStructureTable(rows) {
        if (rows.length === 0) return '';
        const sample = rows[0];
        const landUseKeys = Object.keys(LAND_USE_CONFIG);
        const columns = Object.keys(sample).filter(k => landUseKeys.includes(k));

        let table = `### 土地利用结构 (单位: km² - 请保持原始数值，禁止转换为万单位)\n\n`;

        table += `| 地区 | ${columns.map(c => this.translateColumn(c)).join(' | ')} |\n`;
        table += `|---${columns.map(() => '|---').join('')}|\n`;

        rows.forEach(r => {
            const values = columns.map(c => this.formatNumber(r[c]));
            table += `| ${r.region_name || '云南省'} | ${values.join(' | ')} |\n`;
        });

        return table;
    }

    translateColumn(col) {
        return LAND_USE_CONFIG[col] || col;
    }
}

export class DataRouter {
    constructor() {
        this.extractor = new EntityExtractor();
        this.builder = new ContextBuilder();
    }

    async route(question, componentContext, year = 2023) {
        const entities = this.extractor.extract(question);
        let data = null;

        console.log('[DataRouter] 提取实体:', entities);

        if (componentContext?.type) {
            data = await this.routeByComponent(componentContext, entities, year);
        } else {
            data = await this.routeByEntities(entities, year);
        }

        if (!data) return '';

        const context = this.builder.build(data, entities, componentContext);
        console.log('[DataRouter] 构建上下文长度:', context.length);
        return context;
    }

    async routeByComponent(ctx, entities, year) {
        switch (ctx.type) {
            case 'province_trend':
                return { type: 'trend', rows: await this.getProvinceTrendData() };
            case 'prefecture_pie':
                return { type: 'comparison', rows: await this.getAllPrefectureData(year) };
            case 'county_pie':
                return { type: 'comparison', region: ctx.region, rows: await this.getCountyData(ctx.region, year) };
            default:
                return null;
        }
    }

    async routeByEntities(entities, year) {
        const { prefectures, queryType } = entities;

        if (prefectures.length === 0) {
            if (queryType === 'trend') {
                return { type: 'trend', rows: await this.getProvinceTrendData() };
            }
            return { type: 'structure', rows: await this.getProvinceCurrentData(year) };
        }

        if (prefectures.length === 1) {
            if (queryType === 'trend') {
                return { type: 'trend', region: prefectures[0], rows: await this.getPrefectureTrendData(prefectures[0]) };
            }
            return { type: 'structure', region: prefectures[0], rows: await this.getPrefectureCurrentData(prefectures[0], year) };
        }

        return { type: 'comparison', rows: await this.getMultiplePrefectureData(prefectures, year) };
    }

    async getProvinceTrendData() {
        const { rows } = await pool.query(`
            SELECT year, 
                   MAX(CASE WHEN LOWER(land_use_type) = 'cropland' THEN area END) as cropland,
                   MAX(CASE WHEN LOWER(land_use_type) = 'forest' THEN area END) as forest,
                   MAX(CASE WHEN LOWER(land_use_type) = 'shrub' THEN area END) as shrub,
                   MAX(CASE WHEN LOWER(land_use_type) = 'grassland' THEN area END) as grassland,
                   MAX(CASE WHEN LOWER(land_use_type) = 'water' THEN area END) as water,
                   MAX(CASE WHEN LOWER(land_use_type) = 'wetland' THEN area END) as wetland,
                   MAX(CASE WHEN LOWER(land_use_type) = 'impervious' THEN area END) as impervious,
                   MAX(CASE WHEN LOWER(land_use_type) = 'barren' THEN area END) as barren,
                   MAX(CASE WHEN LOWER(land_use_type) = 'snow_ice' THEN area END) as snow_ice
            FROM clcd_province 
            GROUP BY year ORDER BY year ASC
        `);
        return rows;
    }

    async getProvinceCurrentData(year) {
        const { rows } = await pool.query(`
            SELECT year, 
                   MAX(CASE WHEN LOWER(land_use_type) = 'cropland' THEN area END) as cropland,
                   MAX(CASE WHEN LOWER(land_use_type) = 'forest' THEN area END) as forest,
                   MAX(CASE WHEN LOWER(land_use_type) = 'shrub' THEN area END) as shrub,
                   MAX(CASE WHEN LOWER(land_use_type) = 'grassland' THEN area END) as grassland,
                   MAX(CASE WHEN LOWER(land_use_type) = 'water' THEN area END) as water,
                   MAX(CASE WHEN LOWER(land_use_type) = 'wetland' THEN area END) as wetland,
                   MAX(CASE WHEN LOWER(land_use_type) = 'impervious' THEN area END) as impervious,
                   MAX(CASE WHEN LOWER(land_use_type) = 'barren' THEN area END) as barren,
                   MAX(CASE WHEN LOWER(land_use_type) = 'snow_ice' THEN area END) as snow_ice
            FROM clcd_province 
            WHERE year = $1
            GROUP BY year
        `, [year]);
        return rows;
    }

    async getAllPrefectureData(year) {
        const { rows } = await pool.query(`
            SELECT region_name, cropland, forest, shrub, grassland, water, wetland, impervious, barren, snow_ice
            FROM clcd_prefecture WHERE year = $1 ORDER BY region_name
        `, [year]);
        return rows;
    }

    async getPrefectureCurrentData(name, year) {
        const { rows } = await pool.query(`
            SELECT region_name, cropland, forest, shrub, grassland, water, wetland, impervious, barren, snow_ice
            FROM clcd_prefecture WHERE TRIM(region_name) = $1 AND year = $2
        `, [name, year]);
        return rows;
    }

    async getPrefectureTrendData(name) {
        const { rows } = await pool.query(`
            SELECT year, region_name, cropland, forest, shrub, grassland, water, wetland, impervious, barren, snow_ice
            FROM clcd_prefecture WHERE TRIM(region_name) = $1 ORDER BY year ASC
        `, [name]);
        return rows;
    }

    async getMultiplePrefectureData(names, year) {
        const { rows } = await pool.query(`
            SELECT region_name, cropland, forest, shrub, grassland, water, wetland, impervious, barren, snow_ice
            FROM clcd_prefecture WHERE TRIM(region_name) = ANY($1) AND year = $2
        `, [names, year]);
        return rows;
    }

    async getCountyData(prefectureName, year) {
        const { rows } = await pool.query(`
            SELECT c.region_name, c.cropland, c.forest, c.shrub, c.grassland, c.water, c.wetland, c.impervious, c.barren, c.snow_ice
            FROM public.clcd_county c
            JOIN public.yunnan_country_level_city_boundaries b ON TRIM(c.region_name) = TRIM(b.县级)
            WHERE b.地级 = $1 AND c.year = $2
            ORDER BY c.region_name ASC
        `, [prefectureName, year]);
        return rows;
    }
}
