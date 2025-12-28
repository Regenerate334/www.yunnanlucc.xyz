/**
 * 统一接口管理模块
 * 封装所有后端请求，方便维护和复用
 */

// 基础请求函数
async function request(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API Request Failed: ${url}`, error);
        throw error;
    }
}

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
    getCountyDataByPrefecture: (prefecture) => request(`/api/clcd/county/prefecture/${encodeURIComponent(prefecture)}`)
};

// 行政区划相关接口
export const regionApi = {
    // 获取某级别的区域列表
    getRegions: (level) => request(`/api/regions/${level}`)
};

// 空间分析相关接口
export const analysisApi = {
    // 获取转移矩阵时间段
    getTransferPeriods: () => request('/api/analysis/transfer-matrix/periods'),

    // 获取指定时间段的转移矩阵数据
    getTransferMatrix: (period) => request(`/api/analysis/transfer-matrix/${period}`)
};
