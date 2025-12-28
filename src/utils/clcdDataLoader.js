/**
 * CLCD数据加载工具
 * 用于从后端API加载土地利用统计数据
 * 
 * 逻辑优化：支持按区域加载全量时间序列（用于时间序列监测）
 * 以及按年份加载全量空间数据（用于地图初始化展示）
 */
import { clcdApi, analysisApi } from '../api/index.js';

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

export async function loadLandUseConfig() {
    return LAND_USE_CONFIG;
}

/**
 * 加载省级全量趋势数据
 */
export async function loadProvinceData() {
    return await clcdApi.getProvinceTrend();
}

/**
 * 加载特定地级市的全量时间序列
 */
export async function loadPrefectureTrend(cityName) {
    return await clcdApi.getPrefectureDataByName(cityName);
}

/**
 * 加载特定区县的全量时间序列
 */
export async function loadCountyTrend(countyName) {
    return await clcdApi.getCountyDataByName(countyName);
}

/**
 * 加载某年份所有地级市数据 (用于地图初始渲染)
 */
export async function loadPrefectureDataByYear(year) {
    return await clcdApi.getPrefectureDataByYear(year);
}

/**
 * 加载某年份所有区县数据
 */
export async function loadCountyDataByYear(year) {
    return await clcdApi.getCountyDataByYear(year);
}

/**
 * 获取年份范围
 */
export async function getYearRange() {
    const years = await clcdApi.getYears();
    return {
        minYear: Math.min(...years),
        maxYear: Math.max(...years),
        years: years
    };
}

/**
 * 转换工具：从序列中提取特定年份数据
 */
export function getDataByYear(series, year) {
    if (!series) return null;
    return series.find(d => d.year == year) || null;
}

/**
 * 加载转移矩阵时间段
 */
export async function loadTransferMatrixPeriods() {
    return await analysisApi.getTransferPeriods();
}

/**
 * 加载特定时间段的转移矩阵数据
 */
export async function loadTransferMatrixData(period) {
    return await analysisApi.getTransferMatrix(period);
}
