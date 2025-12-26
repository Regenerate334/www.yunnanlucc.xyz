/**
 * 土地利用变化指标计算
 * Land Use Change Indicators
 */

/**
 * 计算土地利用动态度
 * K = ((Ub - Ua) / Ua) / T × 100%
 * @param {Object} dataT1 - 初期数据
 * @param {Object} dataT2 - 末期数据
 * @param {String} landType - 土地类型
 * @returns {Object} 动态度指标
 */
export function calculateDynamicDegree(dataT1, dataT2, landType = null) {
    if (!dataT1 || !dataT2) {
        return null
    }

    const yearSpan = dataT2.year - dataT1.year

    if (yearSpan === 0) {
        return null
    }

    // 如果指定土地类型，计算单一动态度
    if (landType) {
        const initialArea = dataT1[landType] || 0
        const finalArea = dataT2[landType] || 0

        if (initialArea === 0) return null

        const dynamicDegree = ((finalArea - initialArea) / initialArea) / yearSpan * 100

        return {
            landType,
            initialArea,
            finalArea,
            change: finalArea - initialArea,
            changeRate: parseFloat((((finalArea - initialArea) / initialArea) * 100).toFixed(2)),
            dynamicDegree: parseFloat(dynamicDegree.toFixed(4)),
            yearSpan,
            period: `${dataT1.year}-${dataT2.year}`,
            unit: '%/year'
        }
    }

    // 计算所有类型的动态度
    const landTypes = ['cropland', 'forest', 'grassland', 'shrub',
        'wetland', 'water', 'snow_ice', 'impervious', 'barren']

    const results = {}

    landTypes.forEach(type => {
        const initial = dataT1[type] || 0
        const final = dataT2[type] || 0

        if (initial > 0) {
            const dd = ((final - initial) / initial) / yearSpan * 100
            results[type] = {
                initialArea: initial,
                finalArea: final,
                change: final - initial,
                dynamicDegree: parseFloat(dd.toFixed(4))
            }
        }
    })

    return {
        byType: results,
        period: `${dataT1.year}-${dataT2.year}`,
        yearSpan,
        unit: '%/year'
    }
}

/**
 * 计算综合土地利用动态度
 * LC = (Σ ΔLUi-j / 2Σ LUi) × (1/T) × 100%
 * @param {Object} dataT1 - 初期数据
 * @param {Object} data T2 - 末期数据
 * @returns {Number} 综合动态度
 */
export function calculateComprehensiveDynamicDegree(dataT1, dataT2) {
    if (!dataT1 || !dataT2) return null

    const landTypes = ['cropland', 'forest', 'grassland', 'shrub',
        'wetland', 'water', 'snow_ice', 'impervious', 'barren']

    let totalChange = 0
    let totalInitialArea = 0

    landTypes.forEach(type => {
        const initial = dataT1[type] || 0
        const final = dataT2[type] || 0
        totalChange += Math.abs(final - initial)
        totalInitialArea += initial
    })

    if (totalInitialArea === 0) return null

    const yearSpan = dataT2.year - dataT1.year
    if (yearSpan === 0) return null

    const comprehensiveDegree = (totalChange / (2 * totalInitialArea)) / yearSpan * 100

    return {
        value: parseFloat(comprehensiveDegree.toFixed(4)),
        totalChange,
        totalInitialArea,
        period: `${dataT1.year}-${dataT2.year}`,
        yearSpan,
        unit: '%/year'
    }
}

/**
 * 生成土地利用转移矩阵
 * @param {Array} t1DataArray - 初期各县数据数组
 * @param {Array} t2DataArray - 末期各县数据数组
 * @returns {Object} 转移矩阵
 */
export function generateTransferMatrix(t1DataArray, t2DataArray) {
    if (!t1DataArray || !t2DataArray || t1DataArray.length !== t2DataArray.length) {
        return null
    }

    const landTypes = ['cropland', 'forest', 'grassland', 'shrub',
        'wetland', 'water', 'snow_ice', 'impervious', 'barren']

    // 初始化转移矩阵
    const matrix = {}
    landTypes.forEach(from => {
        matrix[from] = {}
        landTypes.forEach(to => {
            matrix[from][to] = 0
        })
    })

    // 简化版：基于面积变化推算转移（实际需要空间叠加分析）
    // 这里我们用面积变化量作为近似
    t1DataArray.forEach((t1Data, index) => {
        const t2Data = t2DataArray[index]

        landTypes.forEach(type => {
            const change = (t2Data[type] || 0) - (t1Data[type] || 0)

            if (change > 0) {
                // 该类型增加，假设从其他类型转入
                const increasePerType = change / (landTypes.length - 1)
                landTypes.forEach(from => {
                    if (from !== type && (t1Data[from] || 0) > 0) {
                        matrix[from][type] += increasePerType / t1DataArray.length
                    }
                })
            }
        })
    })

    // 计算转移百分比
    const matrixPercentage = {}
    landTypes.forEach(from => {
        matrixPercentage[from] = {}
        let rowTotal = 0

        landTypes.forEach(to => {
            rowTotal += matrix[from][to]
        })

        landTypes.forEach(to => {
            if (rowTotal > 0) {
                matrixPercentage[from][to] = parseFloat((matrix[from][to] / rowTotal * 100).toFixed(2))
            } else {
                matrixPercentage[from][to] = 0
            }
        })
    })

    return {
        absoluteMatrix: matrix,        // 绝对面积转移
        percentageMatrix: matrixPercentage,  // 百分比转移
        landTypes,
        period: t1DataArray[0] && t2DataArray[0] ?
            `${t1DataArray[0].year}-${t2DataArray[0].year}` : 'unknown'
    }
}

/**
 * 计算年均变化速率
 * @param {Array} timeSeriesData - 时间序列数据
 * @param {String} landType - 土地类型
 * @returns {Object} 变化速率
 */
export function calculateChangeRate(timeSeriesData, landType) {
    if (!timeSeriesData || timeSeriesData.length < 2) {
        return null
    }

    // 按年份排序
    const sortedData = [...timeSeriesData].sort((a, b) => a.year - b.year)

    const changes = []
    for (let i = 1; i < sortedData.length; i++) {
        const prev = sortedData[i - 1][landType] || 0
        const curr = sortedData[i][landType] || 0
        const yearSpan = sortedData[i].year - sortedData[i - 1].year

        changes.push({
            year: sortedData[i].year,
            change: curr - prev,
            rate: yearSpan > 0 ? (curr - prev) / yearSpan : 0
        })
    }

    // 计算年均变化速率
    const totalChange = sortedData[sortedData.length - 1][landType] - sortedData[0][landType]
    const totalYears = sortedData[sortedData.length - 1].year - sortedData[0].year
    const averageRate = totalYears > 0 ? totalChange / totalYears : 0

    return {
        landType,
        averageRate: parseFloat(averageRate.toFixed(4)),
        totalChange,
        totalYears,
        changes,
        period: `${sortedData[0].year}-${sortedData[sortedData.length - 1].year}`,
        unit: 'km²/year'
    }
}

/**
 * 检测变化热点（变化最剧烈的地区）
 * @param {Array} dataArray - 多个地区的数据
 * @param {String} landType - 土地类型
 * @param {Number} topN - 返回前N个热点
 * @returns {Array} 热点地区列表
 */
export function detectChangeHotspots(dataArray, landType, topN = 10) {
    if (!dataArray || dataArray.length === 0) {
        return []
    }

    // 假设dataArray包含初期和末期数据
    const hotspots = dataArray.map(item => {
        const dynamicDegree = item.dynamicDegree?.[landType] || 0
        const changeAmount = item.change?.[landType] || 0

        return {
            region: item.region_name,
            regionCode: item.region_code,
            dynamicDegree,
            changeAmount,
            changeType: changeAmount > 0 ? 'increase' : 'decrease'
        }
    })

    // 按动态度绝对值排序
    hotspots.sort((a, b) => Math.abs(b.dynamicDegree) - Math.abs(a.dynamicDegree))

    return hotspots.slice(0, topN)
}

/**
 * 计算时间序列的趋势（简单线性回归）
 * @param {Array} timeSeriesData - 时间序列数据
 * @param {String} landType - 土地类型
 * @returns {Object} 趋势分析结果
 */
export function analyzeTrend(timeSeriesData, landType) {
    if (!timeSeriesData || timeSeriesData.length < 3) {
        return null
    }

    const sortedData = [...timeSeriesData].sort((a, b) => a.year - b.year)
    const n = sortedData.length

    // 提取x (year) 和 y (area)
    const baseYear = sortedData[0].year
    const x = sortedData.map(d => d.year - baseYear)
    const y = sortedData.map(d => d[landType] || 0)

    // 计算均值
    const xMean = x.reduce((sum, val) => sum + val, 0) / n
    const yMean = y.reduce((sum, val) => sum + val, 0) / n

    // 计算斜率和截距
    let numerator = 0
    let denominator = 0

    for (let i = 0; i < n; i++) {
        numerator += (x[i] - xMean) * (y[i] - yMean)
        denominator += Math.pow(x[i] - xMean, 2)
    }

    const slope = denominator !== 0 ? numerator / denominator : 0
    const intercept = yMean - slope * xMean

    // 计算R²
    const yPred = x.map(xi => slope * xi + intercept)
    const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - yPred[i], 2), 0)
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0)
    const rSquared = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0

    return {
        landType,
        trend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
        slope: parseFloat(slope.toFixed(4)),
        intercept: parseFloat(intercept.toFixed(2)),
        rSquared: parseFloat(rSquared.toFixed(4)),
        period: `${sortedData[0].year}-${sortedData[sortedData.length - 1].year}`,
        dataPoints: n,
        prediction: (futureYear) => {
            const x = futureYear - baseYear
            return parseFloat((slope * x + intercept).toFixed(2))
        }
    }
}
