/**
 * 统一接口管理模块
 * 封装所有后端请求，方便维护和复用
 */

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
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API Request Failed: ${url}`, error);
        throw error;
    }
}

// 用户认证相关接口
export const authApi = {
    login: (username, password) => request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    }),
    register: (username, password) => request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    }),
    verify: () => request('/api/auth/verify')
};

// CLCD 数据相关接口
export const clcdApi = {
    // 获取年份列表
    getYears: () => request('/api/clcd/years'),

    // 获取全省统计数据
    getProvinceTrend: () => request('/api/clcd/province'),

    // 获取某年汇总数据
    getYearSummary: (year) => request(`/api/clcd/${year}/summary`),

    // 获取区域趋势数据
    getRegionalTrend: (level, name) => request(`/api/clcd/trend/${level}/${encodeURIComponent(name)}`),

    // 获取所有地级市全量数据
    getAllPrefectureData: () => request('/api/clcd/prefecture'),

    // 获取所有区县全量数据
    getAllCountyData: () => request('/api/clcd/county'),

    // 获取特定地级市全量数据
    getPrefectureDataByName: (name) => request(`/api/clcd/prefecture/name/${encodeURIComponent(name)}`),

    // 获取特定区县全量数据
    getCountyDataByName: (name) => request(`/api/clcd/county/name/${encodeURIComponent(name)}`),

    // 获取某年所有地级市数据
    getPrefectureDataByYear: (year) => request(`/api/clcd/prefecture/year/${year}`),

    // 获取某年所有区县数据
    getCountyDataByYear: (year) => request(`/api/clcd/county/year/${year}`),

    // 获取特定地级市下所有区县的全量数据
    getCountyDataByPrefecture: (prefecture) => request(`/api/clcd/county/prefecture/${encodeURIComponent(prefecture)}`),

    // 获取县级空间数据（GeoJSON格式，用于区域检测分析）
    getSpatialCountyData: (year) => request(`/api/clcd/spatial/county/${year}`),

    // 获取格网级空间数据（GeoJSON格式，用于区域检测分析）
    getSpatialGridData: (year) => request(`/api/clcd/spatial/grid/${year}`),

    // 获取动态分级断点
    getBreaks: (attr, year, method = 'quantile', classes = 8, unit = 'county') => request(`/api/clcd/breaks?attr=${attr}&year=${year}&method=${method}&classes=${classes}&unit=${unit}`),

    // 获取所有可用的年份列表
    getAvailableYears: () => request('/api/clcd/years')
};

// 行政区划相关接口
export const regionApi = {
    // 获取某级别的区域列表
    getRegions: (level) => request(`/api/regions/${level}`),

    // 获取区域层级结构 (地级市 -> 县级市)
    getRegionHierarchy: () => request('/api/regions/hierarchy')
};

// 空间分析相关接口
export const analysisApi = {
    // 获取转移矩阵时间段
    getTransferPeriods: () => request('/api/analysis/transfer-matrix/periods'),

    // 获取指定时间段的转移矩阵数据
    getTransferMatrix: (period) => request(`/api/analysis/transfer-matrix/${period}`),

    // 获取大屏指挥中心综合数据
    getDashboardData: (year, type = 'comprehensive') => request(`/api/analysis/dashboard/${year}?type=${type}`),

    // 动态查询流转 GeoJSON 数据（县域尺度）
    getTransferFlowCounty: (params) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/api/analysis/transfer-flow/county?${qs}`);
    },

    // 动态查询流转 GeoJSON 数据（格网尺度）
    getTransferFlowGrid: (params) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/api/analysis/transfer-flow/grid?${qs}`);
    }
};
