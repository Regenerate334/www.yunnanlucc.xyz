/**
 * 前端全局配置文件 (Frontend Configuration)
 * 作用：集中管理 API 地址、Cesium 视图、GeoServer 图层及 UI 交互常量。
 * 
 * 修改提示：
 * 1. 若后端 API 地址变更，请修改 API_BASE_URL 或 .env 中的环境参数。
 * 2. 新增时序图层时，需在 GEOSERVER_CONFIG.layers 中同步键值对映射。
 * 3. 调整地图初始化区域，请更新 CESIUM_CONFIG.defaultView。
 */

// 1. API 基础配置
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const API_CONFIG = {
    baseUrl: API_BASE_URL,
    timeout: 15000,
    endpoints: {
        auth: '/auth',
        clcd: '/clcd',
        analysis: '/analysis',
        regions: '/regions'
    }
};

// 2. Cesium 地图默认配置
export const CESIUM_CONFIG = {
    // 默认视角 (云南省中心附近)
    defaultView: {
        destination: {
            longitude: 102.712251,
            latitude: 25.040609,
            height: 1000000
        }
    }
};

// 3. GeoServer 配置
export const GEOSERVER_CONFIG = {
    baseUrl: '/geoserver',
    workspace: 'WebGIS',
    wmsUrl: '/geoserver/WebGIS/wms',
    layers: {
        boundary: 'WebGIS:yunnan_country_level_city_boundaries',
        stats: 'WebGIS:spatial_county_yunnan_stats',
        yunnanTime: 'WebGIS:yunnan'
    }
};

// 4. 全局 UI 与交互配置
export const UI_CONFIG = {
    themeColor: '#00ccff',
    sidebarWidth: 260,
    refreshInterval: 1000 * 60 * 5, // 默认 5 分钟
    maxWmsCacheSize: 10, // WMS 图层缓存上限 (提升至 10 以适配预加载和双缓冲过渡)
    // 全局边界样式配置
    BOUNDARY_STYLE: {
        provinceWidth: 3.5,     // 省界线宽
        cityWidth: 2.0,         // 地级市界线宽
        countyWidth: 1.0,       // 县级界线宽
        highlightWidth: 4.0,    // 选中/高亮线宽
        provinceColor: '#FF0000', // 省级：红色
        cityColor: '#9C27B0',     // 地级市：紫色
        countyColor: '#00FFFF',    // 县级：亮青色 (已恢复)
        highlightColor: '#FFFF00'  // 选中高亮：黄色
    }
};

export default {
    API_BASE_URL,
    API_CONFIG,
    CESIUM_CONFIG,
    GEOSERVER_CONFIG,
    UI_CONFIG
};
