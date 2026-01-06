/**
 * 计算综合土地利用动态度 (Comprehensive Land Use Dynamic Degree)
 * 
 * 公式: LC = (Σ|Ubi - Uai| / 2ΣUai) * (1/T) * 100%
 * 
 * @param {Object} startData 基准年数据对象 { cropland: area, ... }
 * @param {Object} endData 结束年数据对象 { cropland: area, ... }
 * @param {number} yearDiff 时间跨度 (T)
 * @returns {number} 动态度百分比
 */
export function calculateDynamicDegree(startData, endData, yearDiff) {
    if (yearDiff <= 0) return 0;

    let totalStart = 0;
    let totalChange = 0;

    // 假设 startData 和 endData 拥有相同的键（地类）
    const landTypes = Object.keys(startData);

    for (const type of landTypes) {
        const startArea = Number(startData[type] || 0);
        const endArea = Number(endData[type] || 0);

        totalStart += startArea;
        totalChange += Math.abs(endArea - startArea);
    }

    if (totalStart === 0) return 0;

    // 公式计算
    const dynamicDegree = (totalChange / (2 * totalStart)) / yearDiff * 100;

    return dynamicDegree;
}

/**
 * 计算单一土地利用动态度 (Single Land Use Dynamic Degree)
 * 
 * 公式: K = (Ub - Ua) / Ua * (1/T) * 100%
 * 
 * @param {number} startArea 基准年面积
 * @param {number} endArea 结束年面积
 * @param {number} yearDiff 时间跨度 (T)
 * @returns {number} 动态度百分比
 */
export function calculateSingleDynamicDegree(startArea, endArea, yearDiff) {
    if (yearDiff <= 0 || startArea <= 0) return 0;
    return ((endArea - startArea) / startArea) / yearDiff * 100;
}
