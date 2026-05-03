/**
 * 统一接口管理模块
 * 封装所有后端请求，方便维护和复用
 */
import { API_BASE_URL } from '../config/index.js';

const inflightRequestMap = new Map();
const responseCacheMap = new Map();

function dedupedRequest(cacheKey, requester, ttlMs = 0) {
    const now = Date.now();
    if (ttlMs > 0) {
        const cached = responseCacheMap.get(cacheKey);
        if (cached && cached.expireAt > now) {
            return Promise.resolve(cached.value);
        }
    }

    const inflight = inflightRequestMap.get(cacheKey);
    if (inflight) return inflight;

    const task = (async () => {
        const value = await requester();
        if (ttlMs > 0) {
            responseCacheMap.set(cacheKey, {
                value,
                expireAt: Date.now() + ttlMs
            });
        }
        return value;
    })().finally(() => {
        inflightRequestMap.delete(cacheKey);
    });

    inflightRequestMap.set(cacheKey, task);
    return task;
}

// 基础请求函数
async function request(url, options = {}) {
    // 从 localStorage 获取 Token
    const token = localStorage.getItem('auth_token');

    if (!token && !url.includes('/api/auth')) {
        console.warn(`[API] Requesting ${url} without token! Current localStorage:`,
            { auth_token: token, keys: Object.keys(localStorage) });
    }

    // 设置默认 Headers
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    // 如果有 Token，添加到 Authorization Header
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, { ...options, headers });

        // 如果返回 401，说明 Token 失效，跳转到登录页
        if (response.status === 401 && !url.includes('/api/auth/login')) {
            console.error(`[API] 401 Unauthorized detected for URL: ${url}. Redirecting to /login...`);
            console.trace('Redirect origin trace:');
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        const result = await response.json();

        // 如果后端使用了统一响应处理中间件 (responseHandler)
        if (result.success !== undefined) {
            if (!result.success) {
                throw new Error(result.message || 'Request failed');
            }
            // 只有当 data 确实存在时才返回 data，否则返回整个 result (兼容旧接口)
            return result.data !== undefined ? result.data : result;
        }

        return result;
    } catch (error) {
        // console.error(`API Request Failed: ${url}`, error);
        throw error;
    }
}

// 用户认证相关接口
export const authApi = {
    login: (username, password) => request(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ username, password })
    }),
    verify: () => request(`${API_BASE_URL}/auth/verify`)
};

// CLCD 数据相关接口
export const clcdApi = {
    // 获取年份列表
    getYears: () => request(`${API_BASE_URL}/clcd/years`),

    // 获取全省统计数据
    getProvinceTrend: () => dedupedRequest(
        'clcd:province',
        () => request(`${API_BASE_URL}/clcd/province`),
        10000
    ),

    // 获取某年汇总数据
    getYearSummary: (year) => request(`${API_BASE_URL}/clcd/${year}/summary`),

    // 获取区域趋势数据
    getRegionalTrend: (level, name) => {
        const encodedName = encodeURIComponent(name);
        return dedupedRequest(
            `clcd:trend:${level}:${encodedName}`,
            () => request(`${API_BASE_URL}/clcd/trend/${level}/${encodedName}`),
            10000
        );
    },

    // 获取所有地级市全量数据
    getAllPrefectureData: () => request(`${API_BASE_URL}/clcd/prefecture`),

    // 获取所有区县全量数据
    getAllCountyData: () => request(`${API_BASE_URL}/clcd/county`),

    // 获取特定地级市全量数据
    getPrefectureDataByName: (name) => request(`${API_BASE_URL}/clcd/prefecture/name/${encodeURIComponent(name)}`),

    // 获取特定区县全量数据
    getCountyDataByName: (name) => request(`${API_BASE_URL}/clcd/county/name/${encodeURIComponent(name)}`),

    // 获取某年所有地级市数据
    getPrefectureDataByYear: (year) => request(`${API_BASE_URL}/clcd/prefecture/year/${year}`),

    // 获取某年所有区县数据
    getCountyDataByYear: (year) => request(`${API_BASE_URL}/clcd/county/year/${year}`),

    // 获取特定地级市下所有区县的全量数据
    getCountyDataByPrefecture: (prefecture) => request(`${API_BASE_URL}/clcd/county/prefecture/${encodeURIComponent(prefecture)}`),

    // 获取县级空间数据（GeoJSON格式，用于区域检测分析）
    getSpatialCountyData: (year) => request(`${API_BASE_URL}/clcd/spatial/county/${year}`),

    // 获取格网级空间数据（GeoJSON格式，用于区域检测分析）
    getSpatialGridData: (year) => request(`${API_BASE_URL}/clcd/spatial/grid/${year}`),

    // 获取动态分级断点
    getBreaks: (attr, year, method = 'quantile', classes = 8, unit = 'county') => request(`${API_BASE_URL}/clcd/breaks?attr=${attr}&year=${year}&method=${method}&classes=${classes}&unit=${unit}`),

    // 获取所有可用的年份列表
    getAvailableYears: () => dedupedRequest(
        'clcd:years',
        () => request(`${API_BASE_URL}/clcd/years`),
        60000
    ),

    // 获取区域实时监测指标（核验重构算法）
    getMonitoring: (level, name, year, policy = '') => {
        const qs = policy ? `?policy=${encodeURIComponent(policy)}` : '';
        return request(`${API_BASE_URL}/clcd/monitoring/${level}/${encodeURIComponent(name)}/${year}${qs}`);
    }
};

// 行政区划相关接口
export const regionApi = {
    // 获取某级别的区域列表
    getRegions: (level) => request(`${API_BASE_URL}/regions/${level}`),

    // 获取区域层级结构 (地级市 -> 县级市)
    getRegionHierarchy: () => request(`${API_BASE_URL}/regions/hierarchy`)
};

// 空间分析相关接口
export const analysisApi = {
    // 获取转移矩阵时间段
    getTransferPeriods: () => request(`${API_BASE_URL}/analysis/transfer-matrix/periods`),

    // 获取指定时间段的转移矩阵数据
    getTransferMatrix: (period) => request(`${API_BASE_URL}/analysis/transfer-matrix/${period}`),

    // 获取大屏指挥中心综合数据
    getDashboardData: (year, type = 'comprehensive') => request(`${API_BASE_URL}/analysis/dashboard/${year}?type=${type}`),

    // 动态查询流转 GeoJSON 数据（县域尺度）
    getTransferFlowCounty: (params) => {
        const qs = new URLSearchParams(params).toString();
        return request(`${API_BASE_URL}/analysis/transfer-flow/county?${qs}`);
    },

    // 动态查询流转 GeoJSON 数据（格网尺度）
    getTransferFlowGrid: (params) => {
        const qs = new URLSearchParams(params).toString();
        return request(`${API_BASE_URL}/analysis/transfer-flow/grid?${qs}`);
    },

    // 动态查询重心迁移与标准差椭圆
    getSpatialStatsSeries: (params) => {
        const qs = new URLSearchParams(params).toString();
        return request(`${API_BASE_URL}/analysis/spatial-stats/transfer-series?${qs}`);
    }
};
