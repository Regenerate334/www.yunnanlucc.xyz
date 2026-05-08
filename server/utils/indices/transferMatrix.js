/**\n * 通用业务工具类 (General Business Utility)\n * 职责：提供系统级的抽象辅助功能，封装 transferMatrix 相关的底层操作逻辑。\n *\n * 修改提示：\n * 1. 本文件为系统底层运行机制的组成部分，修改前请仔细核对依赖关系。\n * 2. 若涉及异步操作，请务必处理 Promise 的 catch 块防止未捕获异常。\n * 3. 遵循现有的 ESLint 和团队代码规范，保持极简及高可读性。\n */\n/**
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
