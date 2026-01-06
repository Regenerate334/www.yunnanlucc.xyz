/**
 * 计算土地利用转移矩阵 (Land Use Transfer Matrix)
 * 
 * @param {Array} rows 数据库查询结果行 [{from_class, to_class, area}, ...]
 * @returns {Object} { absoluteMatrix, percentageMatrix, landTypes }
 */
export function calculateTransferMatrix(rows) {
    const matrix = {};
    const landTypes = new Set();

    // 1. 构建绝对面积矩阵
    rows.forEach(row => {
        landTypes.add(row.from_class);
        landTypes.add(row.to_class);
        if (!matrix[row.from_class]) matrix[row.from_class] = {};
        matrix[row.from_class][row.to_class] = Number(row.area);
    });

    const types = Array.from(landTypes);
    const percentageMatrix = {};

    // 2. 构建百分比矩阵 (流出方向)
    types.forEach(from => {
        percentageMatrix[from] = {};
        let total = 0;
        // 计算该地类流出的总面积
        types.forEach(to => { total += (matrix[from]?.[to] || 0); });

        types.forEach(to => {
            percentageMatrix[from][to] = total > 0 ? parseFloat(((matrix[from]?.[to] || 0) / total * 100).toFixed(2)) : 0;
        });
    });

    return {
        absoluteMatrix: matrix,
        percentageMatrix,
        landTypes: types
    };
}
