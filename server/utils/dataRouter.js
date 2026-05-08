/**
 * DataRouter v4 — 全场景覆盖版
 *
 * 改进点（相比原始版本）：
 * ─────────────────────────────────────────────────────────────────
 * EntityExtractor 新增识别：
 *   - "各地级市/所有地级市/各州市" → allPrefectures: true
 *   - "各县/各区县" → allCounties: true  
 *   - "全省/云南省整体" → provinceLevel: true
 *   - 年份区间 "1985-2023" / "2010到2020" → yearRange: [start, end]
 *   - 更多 queryType：ranking / change_rate / structure / comparison / trend
 *
 * routeByEntities 新增路由：  
 *   - allPrefectures + 趋势    → 省级趋势 + 当前各地级市对比
 *   - allPrefectures + 结构/对比 → 所有地级市数据（指定年份）
 *   - allPrefectures + 排名    → 所有地级市排序数据
 *   - allCounties + 有地级市   → 该地级市所有县数据
 *   - 单地级市 + 有年份范围    → 该地级市趋势
 *   - 跨年对比（2 个年份）     → 返回两个年份数据供 AI 对比
 *
 * ContextBuilder 新增格式化：
 *   - 跨年对比表格
 *   - 排名表格（带序号）
 *   - 变化率计算
 * ─────────────────────────────────────────────────────────────────
 */

import pool from '../config/db.js';
import registry from './dataSourceRegistry.js';
import logger from '../config/logger.js';

// ── 常量配置 ──────────────────────────────────────────────────────────────────

const PREFECTURES = {
    '昆明': '昆明市', '曲靖': '曲靖市', '玉溪': '玉溪市',
    '保山': '保山市', '昭通': '昭通市', '丽江': '丽江市',
    '普洱': '普洱市', '临沧': '临沧市',
    '楚雄': '楚雄彝族自治州', '红河': '红河哈尼族彝族自治州',
    '文山': '文山壮族苗族自治州', '西双版纳': '西双版纳傣族自治州',
    '大理': '大理白族自治州', '德宏': '德宏傣族景颇族自治州',
    '怒江': '怒江傈僳族自治州', '迪庆': '迪庆藏族自治州'
};

/**
 * 云南省全量县级行政区划（129个）
 * 映射关系：县/市/区名 -> 所属州市名
 */
const COUNTIES = {
    // 昆明市
    "五华区": "昆明市", "盘龙区": "昆明市", "官渡区": "昆明市", "西山区": "昆明市", "东川区": "昆明市",
    "呈贡区": "昆明市", "晋宁区": "昆明市", "安宁市": "昆明市", "宜良县": "昆明市", "嵩明县": "昆明市",
    "富民县": "昆明市", "禄劝彝族苗族自治县": "昆明市", "寻甸回族彝族自治县": "昆明市", "石林彝族自治县": "昆明市",
    // 曲靖市
    "麒麟区": "曲靖市", "沾益区": "曲靖市", "马龙区": "曲靖市", "宣威市": "曲靖市", "陆良县": "曲靖市",
    "师宗县": "曲靖市", "罗平县": "曲靖市", "富源县": "曲靖市", "会泽县": "曲靖市",
    // 玉溪市
    "红塔区": "玉溪市", "江川区": "玉溪市", "澄江市": "玉溪市", "通海县": "玉溪市", "华宁县": "玉溪市",
    "易门县": "玉溪市", "峨山彝族自治县": "玉溪市", "新平彝族傣族自治县": "玉溪市", "元江哈尼族彝族傣族自治县": "玉溪市",
    // 保山市
    "隆阳区": "保山市", "腾冲市": "保山市", "施甸县": "保山市", "龙陵县": "保山市", "昌宁县": "保山市",
    // 昭通市
    "昭阳区": "昭通市", "水富市": "昭通市", "鲁甸县": "昭通市", "巧家县": "昭通市", "盐津县": "昭通市",
    "大关县": "昭通市", "永善县": "昭通市", "绥江县": "昭通市", "镇雄县": "昭通市", "彝良县": "昭通市", "威信县": "昭通市",
    // 丽江市
    "古城区": "丽江市", "玉龙纳西族自治县": "丽江市", "永胜县": "丽江市", "华坪县": "丽江市", "宁蒗彝族自治县": "丽江市",
    // 普洱市
    "思茅区": "普洱市", "宁洱哈尼族彝族自治县": "普洱市", "墨江哈尼族自治县": "普洱市", "景东彝族自治县": "普洱市",
    "景谷傣族彝族自治县": "普洱市", "镇沅彝族哈尼族拉祜族自治县": "普洱市", "江城哈尼族彝族自治县": "普洱市",
    "孟连傣族拉祜族佤族自治县": "普洱市", "澜沧拉祜族自治县": "普洱市", "西盟佤族自治县": "普洱市",
    // 临沧市
    "临翔区": "临沧市", "凤庆县": "临沧市", "云县": "临沧市", "永德县": "临沧市", "镇康县": "临沧市",
    "双江拉祜族佤族布朗族傣族自治县": "临沧市", "耿马傣族佤族自治县": "临沧市", "沧源佤族自治县": "临沧市",
    // 楚雄彝族自治州
    "楚雄市": "楚雄彝族自治州", "禄丰市": "楚雄彝族自治州", "双柏县": "楚雄彝族自治州", "牟定县": "楚雄彝族自治州",
    "南华县": "楚雄彝族自治州", "姚安县": "楚雄彝族自治州", "大姚县": "楚雄彝族自治州", "永仁县": "楚雄彝族自治州",
    "元谋县": "楚雄彝族自治州", "武定县": "楚雄彝族自治州",
    // 红河哈尼族彝族自治州
    "个旧市": "红河哈尼族彝族自治州", "开远市": "红河哈尼族彝族自治州", "蒙自市": "红河哈尼族彝族自治州",
    "弥勒市": "红河哈尼族彝族自治州", "屏边苗族自治县": "红河哈尼族彝族自治州", "建水县": "红河哈尼族彝族自治州",
    "石屏县": "红河哈尼族彝族自治州", "泸西县": "红河哈尼族彝族自治州", "元阳县": "红河哈尼族彝族自治州",
    "红河县": "红河哈尼族彝族自治州", "金平苗族瑶族傣族自治县": "红河哈尼族彝族自治州",
    "绿春县": "红河哈尼族彝族自治州", "河口瑶族自治县": "红河哈尼族彝族自治州",
    // 文山壮族苗族自治州
    "文山市": "文山壮族苗族自治州", "砚山县": "文山壮族苗族自治州", "西畴县": "文山壮族苗族自治州",
    "麻栗坡县": "文山壮族苗族自治州", "马关县": "文山壮族苗族自治州", "丘北县": "文山壮族苗族自治州",
    "广南县": "文山壮族苗族自治州", "富宁县": "文山壮族苗族自治州",
    // 西双版纳傣族自治州
    "景洪市": "西双版纳傣族自治州", "勐海县": "西双版纳傣族自治州", "勐腊县": "西双版纳傣族自治州",
    // 大理白族自治州
    "大理市": "大理白族自治州", "漾濞彝族自治县": "大理白族自治州", "祥云县": "大理白族自治州",
    "宾川县": "大理白族自治州", "弥渡县": "大理白族自治州", "南涧彝族自治县": "大理白族自治州",
    "巍山彝族回族自治县": "大理白族自治州", "永平县": "大理白族自治州", "云龙县": "大理白族自治州",
    "洱源县": "大理白族自治州", "剑川县": "大理白族自治州", "鹤庆县": "大理白族自治州",
    // 德宏傣族景颇族自治州
    "瑞丽市": "德宏傣族景颇族自治州", "芒市": "德宏傣族景颇族自治州", "梁河县": "德宏傣族景颇族自治州",
    "盈江县": "德宏傣族景颇族自治州", "陇川县": "德宏傣族景颇族自治州",
    // 怒江傈僳族自治州
    "泸水市": "怒江傈僳族自治州", "福贡县": "怒江傈僳族自治州", "贡山独龙族怒族自治县": "怒江傈僳族自治州",
    "兰坪白族普米族自治县": "怒江傈僳族自治州",
    // 迪庆藏族自治州
    "香格里拉市": "迪庆藏族自治州", "德钦县": "迪庆藏族自治州", "维西傈僳族自治县": "迪庆藏族自治州"
};

const LAND_USE_CONFIG = {
    cropland: '耕地', forest: '林地', shrub: '灌木', grassland: '草地',
    water: '水体', wetland: '湿地', impervious: '建设用地', barren: '裸地', snow_ice: '冰雪'
};

const LAND_TYPES = {
    '耕地': 'cropland', '农田': 'cropland', '农地': 'cropland',
    '林地': 'forest', '森林': 'forest',
    '草地': 'grassland', '草原': 'grassland',
    '水体': 'water', '水域': 'water', '湖泊': 'water', '河流': 'water',
    '建设用地': 'impervious', '城市': 'impervious', '城镇': 'impervious', '居民地': 'impervious',
    '湿地': 'wetland', '沼泽': 'wetland',
    '裸地': 'barren', '荒地': 'barren', '沙漠': 'barren',
    '灌木': 'shrub', '灌丛': 'shrub',
    '冰雪': 'snow_ice', '冰川': 'snow_ice'
};

// "各地级市" 等泛指词的识别词库
const ALL_PREFECTURE_TRIGGERS = [
    '各地级市', '各州市', '各市', '所有地级市', '所有州市',
    '各个地级市', '全省各市', '全省地级市', '地级市分布', '各地区'
];

// "各县" 等县级泛指词
const ALL_COUNTY_TRIGGERS = [
    '各县', '各区县', '各县市', '各区', '县级', '所有县', '县域分布',
    '各个县', '全市各县', '各下辖县'
];

// 全省级别触发词
const PROVINCE_TRIGGERS = [
    '全省', '云南省整体', '省级', '全省整体', '省份总体', '云南整体'
];

// ── EntityExtractor ───────────────────────────────────────────────────────────

export class EntityExtractor {
    /**
     * 从问题中提取所有有用的实体信息。
     * @param {string} question
     * @returns {ExtractedEntities}
     */
    extract(question) {
        if (!question) return this._empty();

        const q = question;
        return {
            prefectures: this.extractPrefectures(q),
            counties: this.extractCounties(q),
            landTypes: this.extractLandTypes(q),
            years: this.extractYears(q),
            yearRange: this.extractYearRange(q),
            queryType: this.classifyQuery(q),
            allPrefectures: this.detectAllPrefectures(q),
            allCounties: this.detectAllCounties(q),
            provinceLevel: this.detectProvinceLevel(q),
            topN: this.extractTopN(q),
            targetLandTypes: this.extractTargetLandTypes(q)  // 用户关注的特定地类
        };
    }

    _empty() {
        return {
            prefectures: [], counties: [], landTypes: [], years: [], yearRange: null,
            queryType: 'general', allPrefectures: false, allCounties: false,
            provinceLevel: false, topN: null, targetLandTypes: []
        };
    }

    extractPrefectures(q) {
        const found = [];
        for (const [short, full] of Object.entries(PREFECTURES)) {
            if (q.includes(short) || q.includes(full)) {
                if (!found.includes(full)) found.push(full);
            }
        }

        // 如果识别到了县级，自动补全其所属的州市
        for (const [county, parent] of Object.entries(COUNTIES)) {
            if (q.includes(county) && !found.includes(parent)) {
                found.push(parent);
            }
        }

        return found;
    }

    /**
     * 提取县级单位
     */
    extractCounties(q) {
        const found = [];
        for (const county of Object.keys(COUNTIES)) {
            // 简单匹配，考虑到长名字（如自治县）
            // 匹配原则：如果是长名字，优先全称匹配；如果是简写，也尝试匹配
            // 这里为了精准度，优先全称，简写匹配可以后续通过模糊搜索增强
            if (q.includes(county)) {
                found.push(county);
            } else if (county.length > 2) {
                // 如果原始地名较长（如“巧家县”），尝试匹配“巧家”
                const short = county.replace(/(县|市|区|自治县|族自治县)$/, '');
                // 增加正则边界检查，避免“红河县”简写“红河”误撞“红河州”
                const regex = new RegExp(`${short}(?![州|级])`);
                if (regex.test(q) && short.length >= 2) {
                    if (!found.includes(county)) found.push(county);
                }
            }
        }
        return found;
    }

    extractLandTypes(q) {
        const found = [];
        for (const [cn, en] of Object.entries(LAND_TYPES)) {
            if (q.includes(cn) && !found.find(f => f.en === en)) {
                found.push({ cn, en });
            }
        }
        return found;
    }

    /**
     * 提取年份，适配 1985、1985年、'85 等格式
     */
    extractYears(q) {
        const matches = q.match(/(19[89]\d|20[0-3]\d)(?:年)?/g);
        return matches ? [...new Set(matches.map(m => parseInt(m)))].sort() : [];
    }

    /**
     * 提取年份区间，如 "1985-2023"、"2000到2020"、"近40年"
     */
    extractYearRange(q) {
        // 增加对“年”字的支持
        const rangeMatch = q.match(/(19[89]\d|20[0-3]\d)(?:年)?\s*[-—~到至]\s*(19[89]\d|20[0-3]\d)(?:年)?/);
        if (rangeMatch) {
            return [parseInt(rangeMatch[1]), parseInt(rangeMatch[2])];
        }
        // "近N年"
        const recentMatch = q.match(/近(\d+)年/);
        if (recentMatch) {
            const n = parseInt(recentMatch[1]);
            return [2023 - n, 2023];
        }
        // "历史" / "趋势" → 默认全时段
        if (q.includes('历史') || q.includes('全时段') || q.includes('1985年以来')) {
            return [1985, 2023];
        }
        return null;
    }

    detectAllPrefectures(q) {
        return ALL_PREFECTURE_TRIGGERS.some(t => q.includes(t));
    }

    detectAllCounties(q) {
        return ALL_COUNTY_TRIGGERS.some(t => q.includes(t));
    }

    detectProvinceLevel(q) {
        return PROVINCE_TRIGGERS.some(t => q.includes(t)) ||
            (q.includes('云南省') && !this.detectAllPrefectures(q) && this.extractPrefectures(q).length === 0);
    }

    /**
     * 提取 "前N名"、"最大N个" 等排名数量
     */
    extractTopN(q) {
        const match = q.match(/(?:前|TOP|top)\s*(\d+)/);
        if (match) return parseInt(match[1]);
        if (q.includes('最大') || q.includes('最高') || q.includes('第一')) return 5;
        if (q.includes('最小') || q.includes('最低') || q.includes('最少')) return 5;
        return null;
    }

    /**
     * 提取用户特别关注的地类（如"只看耕地和建设用地"）
     */
    extractTargetLandTypes(q) {
        const types = [];
        for (const [cn, en] of Object.entries(LAND_TYPES)) {
            if (q.includes(cn) && !types.find(t => t.en === en)) {
                types.push({ cn, en });
            }
        }
        return types;
    }

    classifyQuery(q) {
        // 优先级从高到低
        if (q.match(/变化率|增长率|减少率|动态度|增减/)) return 'change_rate';
        if (q.match(/排名|排行|第一|最大|最多|最小|最少|最高|最低|前\d+/)) return 'ranking';
        if (q.match(/对比|比较|差异|哪个|哪些/)) return 'comparison';
        if (q.match(/趋势|历史|变化|演变|逐年|多年|年际|序列|轨迹/)) return 'trend';
        if (q.match(/结构|占比|比例|分布|组成|构成/)) return 'structure';
        if (q.match(/概况|总体|综合|全貌|整体/)) return 'overview';
        if (q.match(/预测|未来|展望/)) return 'forecast';
        return 'general';
    }
}

// ── StatisticalAnalyzer (新增) ────────────────────────────────────────────────
/**
 * 后端统计分析引擎：在数据交给 AI 前先进行精确计算。
 */
export class StatisticalAnalyzer {
    static calculateTrend(rows, landTypeEn) {
        if (!rows || rows.length < 2) return null;
        const sorted = [...rows].sort((a, b) => a.year - b.year);
        const start = sorted[0];
        const end = sorted[sorted.length - 1];

        const startVal = Number(start[landTypeEn]) || 0;
        const endVal = Number(end[landTypeEn]) || 0;
        const delta = (endVal - startVal) / 1e6; // km²

        let percentChange = 0;
        if (startVal === 0 && endVal > 0) {
            percentChange = 100; // 或者返回 Infinity 表示新增
        } else if (startVal !== 0) {
            percentChange = (delta * 1e6 / startVal) * 100;
        }

        const years = end.year - start.year;
        const cagr = (startVal > 0 && endVal > 0 && years > 0)
            ? (Math.pow(endVal / startVal, 1 / years) - 1) * 100
            : 0;

        // 寻找极值
        let maxRow = sorted[0], minRow = sorted[0];
        sorted.forEach(r => {
            if ((Number(r[landTypeEn]) || 0) > (Number(maxRow[landTypeEn]) || 0)) maxRow = r;
            if ((Number(r[landTypeEn]) || 0) < (Number(minRow[landTypeEn]) || 0)) minRow = r;
        });

        return {
            startYear: start.year,
            endYear: end.year,
            startArea: startVal / 1e6,
            endArea: endVal / 1e6,
            delta,
            percentChange,
            cagr,
            peakYear: maxRow.year,
            peakArea: (Number(maxRow[landTypeEn]) || 0) / 1e6,
            valleyYear: minRow.year,
            valleyArea: (Number(minRow[landTypeEn]) || 0) / 1e6
        };
    }
}

// ── ContextBuilder ────────────────────────────────────────────────────────────

export class ContextBuilder {
    formatKm2(val) {
        const num = (Number(val) || 0) / 1e6;
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    translateCol(col) {
        return LAND_USE_CONFIG[col] || col;
    }

    build(data, entities, componentContext) {
        if (!data || !data.rows || data.rows.length === 0) return '';

        let context = `## 地理空间分析上下文\n\n`;

        // 提取渲染单块数据的内部方法
        const renderBlock = (blockData) => {
            let blockStr = '';
            if (blockData.region) blockStr += `> 区域: ${blockData.region}\n\n`;
            if (blockData.year) blockStr += `> 年份: ${blockData.year}\n\n`;

            switch (blockData.type) {
                case 'trend':
                    blockStr += this.buildTrendTable(blockData.rows, entities);
                    break;
                case 'comparison':
                    blockStr += this.buildComparisonTable(blockData.rows, entities);
                    break;
                case 'ranking':
                    blockStr += this.buildRankingTable(blockData.rows, blockData.rankBy, entities);
                    break;
                case 'cross_year':
                    blockStr += this.buildCrossYearTable(blockData.rows, blockData.years, entities);
                    break;
                case 'structure':
                default:
                    blockStr += this.buildStructureTable(blockData.rows, entities);
            }
            return blockStr + '\n\n';
        };

        context += renderBlock(data);

        // 如果有额外的补充数据块（如趋势 + 当前截面对比）
        if (data.multiBlock && data.extra) {
            context += `---\n\n`;
            context += renderBlock(data.extra);
        }

        return context;
    }

    _getRelevantCols(entities) {
        // 如果用户只关心特定地类，只返回那几列；否则返回全部
        if (entities?.targetLandTypes?.length > 0 && entities.targetLandTypes.length <= 4) {
            return entities.targetLandTypes.map(t => t.en).filter(en => en in LAND_USE_CONFIG);
        }
        return Object.keys(LAND_USE_CONFIG);
    }

    buildTrendTable(rows, entities) {
        const cols = this._getRelevantCols(entities);

        // 检测是否为多区域混合数据
        const regionNames = [...new Set(rows.map(r => r.region_name).filter(Boolean))];
        const isMultiRegion = regionNames.length > 1;

        if (isMultiRegion) {
            // ── 多区域：按区域分组，每个区域独立表格 + 独立统计 ──
            let output = [`### 多区域历史序列数据（经后端核对，禁止擅自压缩）`];

            for (const region of regionNames) {
                const regionRows = rows.filter(r => r.region_name === region).sort((a, b) => a.year - b.year);
                output.push('', `#### ${region}`);

                const headerCells = ['年份', ...cols.map(c => `${this.translateCol(c)}(km²及占比)`)];
                output.push(`| ${headerCells.join(' | ')} |`);
                output.push(`|${headerCells.map(() => '---').join('|')}|`);
                regionRows.forEach(r => {
                    let total = 0;
                    Object.keys(LAND_USE_CONFIG).forEach(c => total += (Number(r[c]) || 0));
                    const cells = cols.map(c => {
                        const val = Number(r[c]) || 0;
                        const km2 = (val / 1e6).toFixed(2);
                        const pct = total > 0 ? ((val / total) * 100).toFixed(2) + '%' : '0.00%';
                        return `${km2} (${pct})`;
                    });
                    output.push(`| ${r.year} | ${cells.join(' | ')} |`);
                });

                // 每个区域独立计算趋势统计
                if (cols.length > 0) {
                    output.push('', `**${region} 核心指标 (Verified Facts)**`);
                    cols.forEach(c => {
                        const stats = StatisticalAnalyzer.calculateTrend(regionRows, c);
                        if (stats) {
                            const direction = stats.delta >= 0 ? '增加' : '减少';
                            output.push(`- **${this.translateCol(c)}**: 从 ${stats.startYear} 年的 ${stats.startArea.toFixed(2)} km² ${direction}至 ${stats.endYear} 年的 ${stats.endArea.toFixed(2)} km²，累计变化 ${Math.abs(stats.delta).toFixed(2)} km² (${stats.percentChange.toFixed(2)}%)，CAGR: ${stats.cagr.toFixed(2)}%。`);
                        }
                    });
                }
            }
            return output.join('\n');
        }

        // ── 单区域趋势（原有逻辑）──
        const headerCells = ['年份', ...cols.map(c => `${this.translateCol(c)}(km²及占比)`)];
        const header = `| ${headerCells.join(' | ')} |`;
        const sep = `|${headerCells.map(() => '---').join('|')}|`;
        const dataRows = rows.map(r => {
            let total = 0;
            ['cropland', 'forest', 'shrub', 'grassland', 'water', 'wetland', 'impervious', 'barren', 'snow_ice'].forEach(c => total += (Number(r[c]) || 0));
            const cells = cols.map(c => {
                const val = Number(r[c]) || 0;
                const km2 = (val / 1e6).toFixed(2);
                const pct = total > 0 ? ((val / total) * 100).toFixed(2) + '%' : '0.00%';
                return `${km2} (${pct})`;
            });
            return `| ${r.year} | ${cells.join(' | ')} |`;
        });

        let output = [`### 历史序列数据（经后端核对，禁止擅自压缩）`, '', header, sep, ...dataRows];

        // 核心地类的统计分析摘要
        if (cols.length > 0) {
            output.push('', '#### 后端预计算核心指标 (Verified Facts)');
            cols.forEach(c => {
                const stats = StatisticalAnalyzer.calculateTrend(rows, c);
                if (stats) {
                    const direction = stats.delta >= 0 ? '增加' : '减少';
                    output.push(`- **${this.translateCol(c)}**: 从 ${stats.startYear} 年的 ${stats.startArea.toFixed(2)} km² ${direction}至 ${stats.endYear} 年的 ${stats.endArea.toFixed(2)} km²。累计变化 ${Math.abs(stats.delta).toFixed(2)} km² (${stats.percentChange.toFixed(2)}%)，年复合增长率(CAGR): ${stats.cagr.toFixed(2)}%。峰值年份: ${stats.peakYear}。`);
                }
            });
        }

        return output.join('\n');
    }

    buildComparisonTable(rows, entities) {
        const cols = this._getRelevantCols(entities);
        const headerCells = ['地区', ...cols.map(c => `${this.translateCol(c)}(km²及占比)`)];
        const header = `| ${headerCells.join(' | ')} |`;
        const sep = `|${headerCells.map(() => '---').join('|')}|`;
        const dataRows = rows.map(r => {
            let total = 0;
            ['cropland', 'forest', 'shrub', 'grassland', 'water', 'wetland', 'impervious', 'barren', 'snow_ice'].forEach(c => total += (Number(r[c]) || 0));
            const cells = cols.map(c => {
                const val = Number(r[c]) || 0;
                const km2 = (val / 1e6).toFixed(2);
                const pct = total > 0 ? ((val / total) * 100).toFixed(2) + '%' : '0.00%';
                return `${km2} (${pct})`;
            });
            return `| ${r.region_name || r.name || '未知'} | ${cells.join(' | ')} |`;
        });
        return [`### 区域对比数据（共 ${rows.length} 个区域）`, '', header, sep, ...dataRows].join('\n');
    }

    buildRankingTable(rows, rankBy, entities) {
        const rankByName = rankBy ? this.translateCol(rankBy) : '综合';
        const headerCells = ['排名', '地区', rankBy ? `${rankByName}(km²)` : '综合动态度(%)'];
        const header = `| ${headerCells.join(' | ')} |`;
        const sep = `|${headerCells.map(() => '---').join('|')}|`;
        const dataRows = rows.map((r, i) => {
            const val = rankBy ? this.formatKm2(r[rankBy]) : (r.value || '—');
            return `| ${i + 1} | ${r.region_name || r.name || '—'} | ${val} |`;
        });
        return [`### ${rankByName} 排名`, '', header, sep, ...dataRows].join('\n');
    }

    /**
     * 跨年对比：同时展示两个年份数据，方便 AI 计算变化量
     */
    buildCrossYearTable(rows, years, entities) {
        if (!rows || rows.length === 0) return '';
        const cols = this._getRelevantCols(entities);

        // 按 year 分组
        const byYear = {};
        rows.forEach(r => {
            const y = r.year;
            if (!byYear[y]) byYear[y] = {};
            const key = r.region_name || 'province';
            byYear[y][key] = r;
        });

        const sortedYears = Object.keys(byYear).sort();
        const regions = [...new Set(rows.map(r => r.region_name || 'province'))];

        let text = `### 跨年对比数据（${sortedYears.join(' vs ')}）\n\n`;

        for (const region of regions) {
            text += `**${region}**\n\n`;
            const headerCells = ['年份', ...cols.map(c => `${this.translateCol(c)}(km²及占比)`)];
            text += `| ${headerCells.join(' | ')} |\n`;
            text += `|${headerCells.map(() => '---').join('|')}|\n`;

            for (const y of sortedYears) {
                const r = byYear[y]?.[region];
                if (!r) continue;
                let total = 0;
                ['cropland', 'forest', 'shrub', 'grassland', 'water', 'wetland', 'impervious', 'barren', 'snow_ice'].forEach(c => total += (Number(r[c]) || 0));
                const cells = cols.map(c => {
                    const val = Number(r[c]) || 0;
                    const km2 = (val / 1e6).toFixed(2);
                    const pct = total > 0 ? ((val / total) * 100).toFixed(2) + '%' : '0.00%';
                    return `${km2} (${pct})`;
                });
                text += `| ${y} | ${cells.join(' | ')} |\n`;
            }

            // 变化量行（如果有 2 个年份）
            if (sortedYears.length === 2) {
                const r1 = byYear[sortedYears[0]]?.[region];
                const r2 = byYear[sortedYears[1]]?.[region];
                if (r1 && r2) {
                    const changeCells = cols.map(c => {
                        const delta = ((Number(r2[c]) || 0) - (Number(r1[c]) || 0)) / 1e6;
                        const sign = delta >= 0 ? '+' : '';
                        return `${sign}${delta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    });
                    text += `| **变化量** | ${changeCells.join(' | ')} |\n`;
                }
            }
            text += '\n';
        }
        return text;
    }

    buildStructureTable(rows, entities) {
        if (rows.length === 0) return '';
        const cols = this._getRelevantCols(entities).filter(k => k in rows[0]);
        let table = `### 土地利用结构 (km²及占比)\n\n`;
        table += `| 地区 | ${cols.map(c => this.translateCol(c)).join(' | ')} |\n`;
        table += `|---${cols.map(() => '|---').join('')}|\n`;
        rows.forEach(r => {
            let total = 0;
            ['cropland', 'forest', 'shrub', 'grassland', 'water', 'wetland', 'impervious', 'barren', 'snow_ice'].forEach(c => total += (Number(r[c]) || 0));
            const values = cols.map(c => {
                const val = Number(r[c]) || 0;
                const km2 = (val / 1e6).toFixed(2);
                const pct = total > 0 ? ((val / total) * 100).toFixed(2) + '%' : '0.00%';
                return `${km2} (${pct})`;
            });
            table += `| ${r.region_name || r.year || '云南省'} | ${values.join(' | ')} |\n`;
        });
        return table;
    }
}

// ── DataRouter ────────────────────────────────────────────────────────────────

export class DataRouter {
    constructor() {
        this.extractor = new EntityExtractor();
        this.builder = new ContextBuilder();
    }

    async route(question, componentContext, year = 2023) {
        try {
            const entities = this.extractor.extract(question);
            logger.info('[DataRouter] 提取实体:', {
                prefectures: entities.prefectures,
                counties: entities.counties,
                years: entities.years,
                yearRange: entities.yearRange,
                queryType: entities.queryType,
                allPrefectures: entities.allPrefectures,
                allCounties: entities.allCounties,
                provinceLevel: entities.provinceLevel,
                topN: entities.topN,
                targetLandTypes: entities.targetLandTypes?.map(t => t.cn)
            });

            let contexts = [];

            // ─ 1. componentContext 上下文积累 (作为背景补充) ──────────────────
            if (componentContext?.type) {
                const compData = await this.routeByComponent(componentContext, entities, year);
                if (compData) {
                    const compCtx = this.builder.build(compData, entities, componentContext);
                    if (compCtx) {
                        contexts.push(`### 当前面板背景 (${componentContext.type})\n${compCtx}`);
                        logger.info(`[DataRouter] 载入界面背景数据: ${componentContext.type}`);
                    }
                }
            }

            // ─ 2. 实体驱动路由 (核心分析数据) ──────────────────────────────────
            const entityData = await this.routeByEntities(entities, year);
            if (entityData) {
                const entityCtx = this.builder.build(entityData, entities, componentContext);
                if (entityCtx) {
                    // 如果实体路由跟背景路由完全一致(比如前100字符相同)，则不重复添加
                    if (!contexts.some(c => c.includes(entityCtx.substring(0, 50)))) {
                        contexts.push(entityCtx);
                        logger.info(`[DataRouter] 命中实体路由, type: ${entityData.type}`);
                    }
                }
            }

            // ─ 3. 插件注册表路由 (专题数据，如土地流转) ──────────────────────────
            const pluginCtx = await registry.queryIfMatch(question, entities, year);
            if (pluginCtx) {
                contexts.push(pluginCtx);
                logger.info('[DataRouter] 命中插件路由');
            }

            if (contexts.length > 0) {
                return contexts.join('\n\n---\n\n');
            }

            logger.info('[DataRouter] 无路由命中，返回空上下文');
            return '';
        } catch (err) {
            logger.error('[DataRouter] 数据路由过程发生异常', { message: err?.message || String(err), stack: err?.stack });
            return `> 数据查询异常：${err.message}，请基于内置知识或重新描述问题进行回答。`;
        }
    }

    // ── componentContext 精确路由（原有，不变）───────────────────────────────

    async routeByComponent(ctx, entities, year) {
        switch (ctx.type) {
            case 'province_trend':
                return { type: 'trend', rows: await this.getProvinceTrendData() };
            case 'prefecture_pie':
                if (ctx.region) {
                    const [currentRows, trendRows] = await Promise.all([
                        this.getPrefectureCurrentData(ctx.region, year),
                        this.getPrefectureTrendData(ctx.region)
                    ]);
                    return {
                        type: 'comparison', year: year, rows: currentRows,
                        extra: { type: 'trend', region: ctx.region, rows: trendRows },
                        multiBlock: true
                    };
                }
                return { type: 'comparison', rows: await this.getAllPrefectureData(year) };
            case 'county_pie':
                return { type: 'comparison', region: ctx.region, rows: await this.getCountyData(ctx.region, year) };
            default:
                return null;
        }
    }

    // ── 全场景实体驱动路由（重点重构）────────────────────────────────────────

    async routeByEntities(entities, year) {
        const { prefectures, years, yearRange, queryType,
            allPrefectures, allCounties, provinceLevel, topN } = entities;

        // 确定目标年份
        const targetYear = years.length === 1 ? years[0] : year;
        const hasYearRange = yearRange !== null || years.length >= 2;
        const effectiveRange = yearRange || (years.length >= 2 ? [Math.min(...years), Math.max(...years)] : null);

        // ════════════════════════════ 各地级市场景 ════════════════════════════
        if (allPrefectures) {
            // 场景：各地级市 + 趋势/历史/变化 → 省级趋势 + 当前各地级市
            if (queryType === 'trend' || queryType === 'change_rate' || hasYearRange) {
                const [trendRows, prefRows] = await Promise.all([
                    this.getProvinceTrendData(),
                    this.getAllPrefectureData(targetYear)
                ]);
                // 返回两块数据合并
                return {
                    type: 'trend',
                    rows: trendRows,
                    extra: { type: 'comparison', rows: prefRows, year: targetYear },
                    multiBlock: true
                };
            }
            // 场景：各地级市 + 排名
            if (queryType === 'ranking') {
                const rows = await this.getAllPrefectureData(targetYear);
                const rankBy = entities.targetLandTypes?.[0]?.en || 'forest';
                const sorted = [...rows].sort((a, b) => (Number(b[rankBy]) || 0) - (Number(a[rankBy]) || 0));
                return { type: 'ranking', rankBy, rows: topN ? sorted.slice(0, topN) : sorted };
            }
            // 场景：各地级市 + 特定年份结构/对比
            const rows = await this.getAllPrefectureData(targetYear);
            return { type: 'comparison', year: targetYear, rows };
        }

        // ════════════════════════════ 各县场景 ════════════════════════════════
        if (allCounties) {
            if (prefectures.length === 1) {
                // "昆明各县/各区县土地利用"
                const rows = await this.getCountyData(prefectures[0], targetYear);
                return { type: 'comparison', region: prefectures[0], year: targetYear, rows };
            }
            // 没有指定地级市，默认返回省级县域数量太多，改为省级概况
        }

        // ════════════════════════════ 具体地级市场景 ══════════════════════════
        if (prefectures.length >= 1) {
            // 趋势查询（优先级最高：queryType 显式为 trend/change_rate）
            if (queryType === 'trend' || queryType === 'change_rate') {
                if (prefectures.length === 1) {
                    const rows = await this.getPrefectureTrendData(prefectures[0]);
                    return { type: 'trend', region: prefectures[0], rows };
                }
                // 多个地级市的趋势 → 并行获取各自的完整历史序列
                const allTrends = await Promise.all(
                    prefectures.map(p => this.getPrefectureTrendData(p))
                );
                const rows = allTrends.flat();
                return { type: 'trend', region: prefectures.join('和'), rows, multi: true };
            }

            // 跨年对比：仅当用户明确指定了 2 个年份且跨度较小（≤5年）时触发
            // 大跨度年份区间（如 1985-2023 来自"历史"关键词）应走趋势分支
            if (years.length >= 2 || effectiveRange) {
                const [y1, y2] = effectiveRange || [years[0], years[1]];
                const span = Math.abs(y2 - y1);

                if (span <= 5) {
                    // 短跨度：跨年对比（只返回 2 个年份的面状对比）
                    const rows = await this.getPrefectureCrossYearData(prefectures, y1, y2);
                    return { type: 'cross_year', years: [y1, y2], rows };
                } else {
                    // 长跨度：当作趋势处理，获取完整历史序列
                    if (prefectures.length === 1) {
                        const rows = await this.getPrefectureTrendData(prefectures[0]);
                        return { type: 'trend', region: prefectures[0], rows };
                    }
                    const allTrends = await Promise.all(
                        prefectures.map(p => this.getPrefectureTrendData(p))
                    );
                    const rows = allTrends.flat();
                    return { type: 'trend', region: prefectures.join('和'), rows, multi: true };
                }
            }

            if (prefectures.length === 1) {
                // 单地级市结构查询 + 隐式包含趋势
                const [currentRows, trendRows] = await Promise.all([
                    this.getPrefectureCurrentData(prefectures[0], targetYear),
                    this.getPrefectureTrendData(prefectures[0])
                ]);
                return {
                    type: 'structure', region: prefectures[0], year: targetYear, rows: currentRows,
                    extra: { type: 'trend', region: prefectures[0], rows: trendRows },
                    multiBlock: true
                };
            } else {
                // 多个市结构对比 + 隐式包含趋势
                const targetYear = (years.length > 0) ? years[0] : 2023;
                const [currentRows, trendRowsArr] = await Promise.all([
                    this.getMultiplePrefectureData(prefectures, targetYear),
                    Promise.all(prefectures.map(p => this.getPrefectureTrendData(p)))
                ]);
                return {
                    type: 'comparison', year: targetYear, rows: currentRows,
                    extra: { type: 'trend', region: prefectures.join('和'), rows: trendRowsArr.flat(), multi: true },
                    multiBlock: true
                };
            }
        }

        // ════════════════════════════ 省级场景 ════════════════════════════════
        // 排名查询（全省各地级市排名）
        if (queryType === 'ranking') {
            const rows = await this.getAllPrefectureData(targetYear);
            const rankBy = entities.targetLandTypes?.[0]?.en || 'cropland';
            const sorted = [...rows].sort((a, b) => (Number(b[rankBy]) || 0) - (Number(a[rankBy]) || 0));
            return { type: 'ranking', rankBy, rows: topN ? sorted.slice(0, topN) : sorted.slice(0, 16) };
        }

        // 省级趋势（含"历史"、"趋势"、"变化"、"近N年" 等）
        // 智能增强：如果检测到年份区间跨度大（>5年），即便没有关键词也按趋势处理
        const isLongTerm = effectiveRange && (effectiveRange[1] - effectiveRange[0] >= 5);
        if (queryType === 'trend' || queryType === 'change_rate' || hasYearRange || isLongTerm) {
            return { type: 'trend', rows: await this.getProvinceTrendData() };
        }

        // 对比/结构 → 各地级市当年数据（最有参考价值）
        if (queryType === 'comparison' || queryType === 'structure') {
            const rows = await this.getAllPrefectureData(targetYear);
            return { type: 'comparison', year: targetYear, rows };
        }

        // 通用兜底：省级当年数据
        const rows = await this.getProvinceCurrentData(targetYear);
        return { type: 'structure', year: targetYear, rows };
    }

    // ── SQL 查询方法 ─────────────────────────────────────────────────────────

    async getProvinceTrendData() {
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
            FROM clcd_province GROUP BY year ORDER BY year ASC
        `);
        return rows;
    }

    async getProvinceCurrentData(year) {
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
            FROM clcd_province WHERE year = $1 GROUP BY year
        `, [year]);
        return rows;
    }

    async getAllPrefectureData(year) {
        const { rows } = await pool.query(`
            SELECT region_name, cropland, forest, shrub, grassland,
                   water, wetland, impervious, barren, snow_ice
            FROM clcd_prefecture WHERE year = $1 ORDER BY region_name
        `, [year]);
        return rows;
    }

    async getPrefectureCurrentData(name, year) {
        const { rows } = await pool.query(`
            SELECT region_name, cropland, forest, shrub, grassland,
                   water, wetland, impervious, barren, snow_ice
            FROM clcd_prefecture WHERE TRIM(region_name) = $1 AND year = $2
        `, [name, year]);
        return rows;
    }

    async getPrefectureTrendData(name) {
        const { rows } = await pool.query(`
            SELECT year, region_name, cropland, forest, shrub, grassland,
                   water, wetland, impervious, barren, snow_ice
            FROM clcd_prefecture WHERE TRIM(region_name) = $1 ORDER BY year ASC
        `, [name]);
        return rows;
    }

    async getMultiplePrefectureData(names, year) {
        const { rows } = await pool.query(`
            SELECT region_name, cropland, forest, shrub, grassland,
                   water, wetland, impervious, barren, snow_ice
            FROM clcd_prefecture WHERE TRIM(region_name) = ANY($1) AND year = $2
        `, [names, year]);
        return rows;
    }

    /**
     * 获取多个地级市在两个年份的数据，用于跨年对比。
     */
    async getPrefectureCrossYearData(names, yearStart, yearEnd) {
        const { rows } = await pool.query(`
            SELECT year, region_name, cropland, forest, shrub, grassland,
                   water, wetland, impervious, barren, snow_ice
            FROM clcd_prefecture
            WHERE TRIM(region_name) = ANY($1) AND year = ANY($2::int[])
            ORDER BY region_name, year
        `, [names, [yearStart, yearEnd]]);
        return rows;
    }

    async getCountyData(prefectureName, year) {
        const { rows } = await pool.query(`
            SELECT c.region_name, c.cropland, c.forest, c.shrub, c.grassland,
                   c.water, c.wetland, c.impervious, c.barren, c.snow_ice
            FROM public.clcd_county c
            JOIN public.yunnan_country_level_city_boundaries b
              ON TRIM(c.region_name) = TRIM(b.县级)
            WHERE b.地级 = $1 AND c.year = $2 ORDER BY c.region_name ASC
        `, [prefectureName, year]);
        return rows;
    }
}

export default new DataRouter();
