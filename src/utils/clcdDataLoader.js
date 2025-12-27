/**
 * CLCD数据加载工具
 * 用于从后端API加载土地利用统计数据
 */
import { clcdApi, analysisApi } from '../api/index.js';

// 缓存加载的数据
let cachedProvinceData = null;
let cachedPrefectureData = null;
let cachedCountyData = null;

// Inlined configuration matching database keys
const LAND_USE_CONFIG = {
    "land_use_types": [
        { "code": 1, "name_en": "cropland", "name_zh": "耕地", "name_zh_short": "耕地", "color": "#FFD700", "description": "Cropland including paddy fields and dry farmland" },
        { "code": 2, "name_en": "forest", "name_zh": "森林", "name_zh_short": "森林", "color": "#228B22", "description": "Forest including evergreen, deciduous, and mixed forests" },
        { "code": 3, "name_en": "grassland", "name_zh": "草地", "name_zh_short": "草地", "color": "#90EE90", "description": "Grassland including meadows and sparse grassland" },
        { "code": 4, "name_en": "shrub", "name_zh": "灌木", "name_zh_short": "灌木", "color": "#9ACD32", "description": "Shrubland including shrub-covered areas" },
        { "code": 5, "name_en": "wetland", "name_zh": "湿地", "name_zh_short": "湿地", "color": "#87CEEB", "description": "Wetland including marshes and swamps" },
        { "code": 6, "name_en": "water", "name_zh": "水体", "name_zh_short": "水体", "color": "#4169E1", "description": "Water bodies including rivers, lakes, and reservoirs" },
        { "code": 7, "name_en": "snow_ice", "name_zh": "冰雪", "name_zh_short": "冰雪", "color": "#B0C4DE", "description": "Snow and Ice" },
        { "code": 8, "name_en": "impervious", "name_zh": "不透水面", "name_zh_short": "建设用地", "color": "#DC143C", "description": "Impervious surfaces including urban and built-up areas" },
        { "code": 9, "name_en": "barren", "name_zh": "裸地", "name_zh_short": "裸地", "color": "#D2B48C", "description": "Bareland including bare soil, sand, and rocks" }
    ]
};

/**
 * 加载配置文件
 */
export async function loadLandUseConfig() {
    return LAND_USE_CONFIG;
}

/**
 * 加载省级数据
 */
export async function loadProvinceData() {
    if (cachedProvinceData) {
        return cachedProvinceData;
    }

    try {
        cachedProvinceData = await clcdApi.getProvinceTrend();
        return cachedProvinceData;
    } catch (error) {
        console.error('Error loading province data:', error);
        throw error;
    }
}

/**
 * 加载地级市数据
 */
export async function loadPrefectureData() {
    if (cachedPrefectureData) {
        return cachedPrefectureData;
    }

    try {
        cachedPrefectureData = await clcdApi.getPrefectureData();
        return cachedPrefectureData;
    } catch (error) {
        console.error('Error loading prefecture data:', error);
        throw error;
    }
}

/**
 * 加载县级数据
 */
export async function loadCountyData() {
    if (cachedCountyData) {
        return cachedCountyData;
    }

    try {
        cachedCountyData = await clcdApi.getCountyData();
        return cachedCountyData;
    } catch (error) {
        console.error('Error loading county data:', error);
        throw error;
    }
}

/**
 * 获取指定年份的省级数据
 * @param {number} year - 年份
 * @returns {Object|null} 该年份的数据
 */
export async function getProvinceDataByYear(year) {
    const data = await loadProvinceData();
    return data.find(item => item.year === year) || null;
}

/**
 * 获取指定年份的地级市数据
 * @param {number} year - 年份
 * @param {string} cityName - 城市名称（可选）
 * @returns {Array} 该年份的数据
 */
export async function getPrefectureDataByYear(year, cityName = null) {
    const data = await loadPrefectureData();
    let filtered = data.filter(item => item.year === year);

    if (cityName) {
        filtered = filtered.filter(item => item.region_name === cityName);
    }

    return filtered;
}

/**
 * 获取指定年份的县级数据
 * @param {number} year - 年份
 * @param {string} countyName - 县名称（可选）
 * @returns {Array} 该年份的数据
 */
export async function getCountyDataByYear(year, countyName = null) {
    const data = await loadCountyData();
    let filtered = data.filter(item => item.year === year);

    if (countyName) {
        filtered = filtered.filter(item => item.region_name === countyName);
    }

    return filtered;
}

/**
 * 获取年份范围
 * @returns {Object} { minYear, maxYear, years }
 */
export async function getYearRange() {
    const data = await loadProvinceData();
    const years = [...new Set(data.map(item => item.year))].sort();

    return {
        minYear: years[0],
        maxYear: years[years.length - 1],
        years: years
    };
}

/**
 * 获取所有地级市名称
 * @returns {Array<string>}
 */
export async function getPrefectureNames() {
    const data = await loadPrefectureData();
    return [...new Set(data.map(item => item.region_name))];
}

/**
 * 获取所有县名称
 * @returns {Array<string>}
 */
export async function getCountyNames() {
    const data = await loadCountyData();
    return [...new Set(data.map(item => item.region_name))];
}

/**
 * 将数据转换为饼图格式
 * @param {Object} yearData - 某年的数据
 * @param {Object} config - 配置对象
 * @returns {Array} 饼图数据
 */
export function convertToPieChartData(yearData, config) {
    if (!yearData || !config) {
        return [];
    }

    const landUseTypes = config.land_use_types;
    const pieData = [];

    landUseTypes.forEach(type => {
        const value = yearData[type.name_en];
        if (value && value > 0) {
            pieData.push({
                name: type.name_zh,
                value: value,
                itemStyle: {
                    color: type.color
                }
            });
        }
    });

    return pieData;
}

/**
 * 将数据转换为趋势图格式
 * @param {Array} timeSeriesData - 时间序列数据
 * @param {Object} config - 配置对象
 * @returns {Object} 趋势图数据 { years, series }
 */
export function convertToTrendChartData(timeSeriesData, config) {
    if (!timeSeriesData || timeSeriesData.length === 0 || !config) {
        return { years: [], series: [] };
    }

    const landUseTypes = config.land_use_types;
    const years = timeSeriesData.map(item => item.year).sort();
    const series = [];

    landUseTypes.forEach(type => {
        const seriesData = timeSeriesData
            .sort((a, b) => a.year - b.year)
            .map(item => item[type.name_en] || 0);

        series.push({
            name: type.name_zh,
            type: 'line',
            data: seriesData,
            itemStyle: {
                color: type.color
            },
            lineStyle: {
                color: type.color
            }
        });
    });

    return { years, series };
}

/**
 * 清除缓存（用于强制重新加载）
 */
export function clearCache() {
    cachedProvinceData = null;
    cachedPrefectureData = null;
    cachedCountyData = null;
}

/**
 * 加载转移矩阵可用时间段
 */
export async function loadTransferMatrixPeriods() {
    try {
        return await analysisApi.getTransferPeriods();
    } catch (error) {
        console.error('Error loading transfer matrix periods:', error);
        throw error;
    }
}

/**
 * 加载指定时间段的转移矩阵
 * @param {string} period - 时间段 (e.g. "1985_1990")
 */
export async function loadTransferMatrixData(period) {
    try {
        return await analysisApi.getTransferMatrix(period);
    } catch (error) {
        console.error(`Error loading transfer matrix for ${period}:`, error);
        throw error;
    }
}
