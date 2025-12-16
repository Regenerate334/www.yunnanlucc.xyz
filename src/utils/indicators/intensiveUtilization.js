/**
 * 集约利用指标计算
 * Intensive Utilization Indicators
 */

/**
 *  计算城镇扩张指标
 * @param {Array} timeSeriesData - 时间序列数据
 * @returns {Object} 扩张指标
 */
export function calculateUrbanExpansionIndicators(timeSeriesData) {
    if (!timeSeriesData || timeSeriesData.length < 2) {
        return null
    }

    const sortedData = [...timeSeriesData].sort((a, b) => a.year - b.year)
    const initialData = sortedData[0]
    const finalData = sortedData[sortedData.length - 1]

    const yearSpan = finalData.year - initialData.year
    if (yearSpan === 0) return null

    // 城市建设用地扩张
    const initialUrban = initialData.impervious || 0
    const finalUrban = finalData.impervious || 0
    const urbanExpansion = finalUrban - initialUrban

    // 扩张速度
    const expansionSpeed = urbanExpansion / yearSpan

    // 扩张强度（相对变化率）
    const expansionIntensity = initialUrban > 0 ?
        (urbanExpansion / initialUrban) * 100 : 0

    // 年均扩张率
    const annualExpansionRate = initialUrban > 0 ?
        (Math.pow(finalUrban / initialUrban, 1 / yearSpan) - 1) * 100 : 0

    return {
        initialUrbanArea: parseFloat(initialUrban.toFixed(2)),
        finalUrbanArea: parseFloat(finalUrban.toFixed(2)),
        expansion: parseFloat(urbanExpansion.toFixed(2)),
        expansionSpeed: parseFloat(expansionSpeed.toFixed(4)),
        expansionIntensity: parseFloat(expansionIntensity.toFixed(2)),
        annualExpansionRate: parseFloat(annualExpansionRate.toFixed(4)),
        period: `${initialData.year}-${finalData.year}`,
        yearSpan,
        unit: {
            area: 'km²',
            speed: 'km²/year',
            intensity: '%',
            rate: '%/year'
        }
    }
}

/**
 * 计算城市紧凑度
 * @param {Object} data - 土地数据
 * @param {Number} urbanPopulation - 城镇人口
 * @returns {Object} 紧凑度指标
 */
export function calculateUrbanCompactness(data, urbanPopulation) {
    if (!data || !urbanPopulation || urbanPopulation === 0) {
        return null
    }

    const urbanArea = data.impervious || 0
    if (urbanArea === 0) return null

    // 人口密度 (人/km²)
    const populationDensity = urbanPopulation / urbanArea

    // 紧凑度评分
    let compactnessScore = 0
    let compactnessLevel = 'low'

    if (populationDensity > 10000) {
        compactnessScore = 90
        compactnessLevel = 'very_high'
    } else if (populationDensity > 5000) {
        compactnessScore = 75
        compactnessLevel = 'high'
    } else if (populationDensity > 2000) {
        compactnessScore = 60
        compactnessLevel = 'medium'
    } else if (populationDensity > 1000) {
        compactnessScore = 45
        compactnessLevel = 'low'
    } else {
        compactnessScore = 30
        compactnessLevel = 'very_low'
    }

    return {
        urbanArea,
        urbanPopulation,
        populationDensity: parseFloat(populationDensity.toFixed(2)),
        compactnessScore,
        compactnessLevel,
        year: data.year,
        region: data.region_name,
        unit: 'persons/km²'
    }
}

/**
 * 计算土地利用效率指标
 * @param {Object} data - 土地数据
 * @param {Number} gdp - GDP (亿元)
 * @param {Number} population - 人口数
 * @returns {Object} 效率指标
 */
export function calculateLandUseEfficiency(data, gdp, population) {
    if (!data) return null

    const urbanArea = data.impervious || 0
    const croplandArea = data.cropland || 0
    const totalArea = Object.keys(data)
        .filter(key => !['year', 'level', 'region_name', 'region_code', 'unit'].includes(key))
        .reduce((sum, key) => sum + (data[key] || 0), 0)

    const indicators = {}

    // 地均GDP (亿元/km²)
    if (gdp && urbanArea > 0) {
        indicators.gdpPerUrbanArea = parseFloat((gdp / urbanArea).toFixed(4))
    }

    // 人均城镇用地 (m²/人)
    if (population && urbanArea > 0) {
        // 转换为平方米
        indicators.urbanAreaPerCapita = parseFloat((urbanArea * 1000000 / population).toFixed(2))
    }

    // 建设用地集约度评分
    if (indicators.gdpPerUrbanArea) {
        let intensityScore = 0
        const gdpDensity = indicators.gdpPerUrbanArea

        if (gdpDensity > 100) intensityScore = 90
        else if (gdpDensity > 50) intensityScore = 75
        else if (gdpDensity > 20) intensityScore = 60
        else if (gdpDensity > 10) intensityScore = 45
        else intensityScore = 30

        indicators.intensityScore = intensityScore
    }

    // 土地利用综合程度指数
    if (totalArea > 0) {
        const utilizationIndex = ((croplandArea + urbanArea) / totalArea) * 100
        indicators.utilizationIndex = parseFloat(utilizationIndex.toFixed(2))
    }

    return {
        indicators,
        metadata: {
            year: data.year,
            region: data.region_name,
            urbanArea,
            croplandArea,
            totalArea,
            gdp,
            population
        },
        unit: {
            gdpPerUrbanArea: '亿元/km²',
            urbanAreaPerCapita: 'm²/person',
            utilizationIndex: '%'
        }
    }
}

/**
 * 计算建设用地增长弹性系数
 * @param {Object} dataT1 - 初期数据
 * @param {Object} dataT2 - 末期数据
 * @param {Number} gdpT1 - 初期GDP
 * @param {Number} gdpT2 - 末期GDP
 * @returns {Object} 弹性系数
 */
export function calculateUrbanElasticityCoefficient(dataT1, dataT2, gdpT1, gdpT2) {
    if (!dataT1 || !dataT2 || !gdpT1 || !gdpT2) {
        return null
    }

    const urbanT1 = dataT1.impervious || 0
    const urbanT2 = dataT2.impervious || 0

    if (urbanT1 === 0 || gdpT1 === 0) return null

    const yearSpan = dataT2.year - dataT1.year
    if (yearSpan === 0) return null

    // 建设用地增长率
    const urbanGrowthRate = ((urbanT2 - urbanT1) / urbanT1) * 100

    // GDP增长率
    const gdpGrowthRate = ((gdpT2 - gdpT1) / gdpT1) * 100

    // 弹性系数 = 建设用地增长率 / GDP增长率
    const elasticityCoefficient = gdpGrowthRate !== 0 ?
        urbanGrowthRate / gdpGrowthRate : null

    // 评价
    let evaluation = ''
    if (elasticityCoefficient === null) {
        evaluation = 'cannot_calculate'
    } else if (elasticityCoefficient < 0.3) {
        evaluation = 'excellent' // 低消耗高产出
    } else if (elasticityCoefficient < 0.6) {
        evaluation = 'good'
    } else if (elasticityCoefficient < 1.0) {
        evaluation = 'fair'
    } else if (elasticityCoefficient < 1.5) {
        evaluation = 'poor' // 高消耗低产出
    } else {
        evaluation = 'very_poor'
    }

    return {
        elasticityCoefficient: elasticityCoefficient !== null ?
            parseFloat(elasticityCoefficient.toFixed(4)) : null,
        evaluation,
        urbanGrowthRate: parseFloat(urbanGrowthRate.toFixed(2)),
        gdpGrowthRate: parseFloat(gdpGrowthRate.toFixed(2)),
        period: `${dataT1.year}-${dataT2.year}`,
        yearSpan,
        interpretation: getElasticityInterpretation(evaluation)
    }
}

/**
 * 获取弹性系数解释
 */
function getElasticityInterpretation(evaluation) {
    const interpretations = {
        excellent: '土地集约利用水平高，经济增长效率优秀',
        good: '土地利用较为集约，经济产出效率良好',
        fair: '土地利用效率一般，有提升空间',
        poor: '土地消耗过快，集约利用水平较低',
        very_poor: '土地粗放利用严重，亟需提高效率',
        cannot_calculate: '数据不足，无法计算'
    }

    return interpretations[evaluation] || ''
}

/**
 * 综合集约利用评价
 * @param {Object} data - 土地数据
 * @param {Object} socioEconomic - 社会经济数据 {gdp, population, urbanPopulation}
 * @returns {Object} 综合评价
 */
export function comprehensiveIntensiveEvaluation(data, socioEconomic) {
    const { gdp, population, urbanPopulation } = socioEconomic || {}

    const scores = []

    // 1. 土地利用效率
    const efficiency = calculateLandUseEfficiency(data, gdp, population)
    if (efficiency?.indicators?.intensityScore) {
        scores.push(efficiency.indicators.intensityScore)
    }

    // 2. 城市紧凑度
    const compactness = calculateUrbanCompactness(data, urbanPopulation)
    if (compactness?.compactnessScore) {
        scores.push(compactness.compactnessScore)
    }

    // 3. 人均建设用地控制
    if (efficiency?.indicators?.urbanAreaPerCapita) {
        const perCapita = efficiency.indicators.urbanAreaPerCapita
        let landControlScore = 0

        // 根据国家标准，人均城镇建设用地应控制在 100-120 m²
        if (perCapita >= 90 && perCapita <= 120) {
            landControlScore = 90
        } else if (perCapita >= 80 && perCapita <= 130) {
            landControlScore = 75
        } else if (perCapita >= 70 && perCapita <= 150) {
            landControlScore = 60
        } else {
            landControlScore = 40
        }

        scores.push(landControlScore)
    }

    // 计算综合评分
    const finalScore = scores.length > 0 ?
        scores.reduce((sum, s) => sum + s, 0) / scores.length : 0

    let grade = 'D'
    if (finalScore >= 85) grade = 'A'
    else if (finalScore >= 75) grade = 'B'
    else if (finalScore >= 60) grade = 'C'

    return {
        finalScore: parseFloat(finalScore.toFixed(1)),
        grade,
        componentScores: {
            efficiency: efficiency?.indicators?.intensityScore || null,
            compactness: compactness?.compactnessScore || null,
            landControl: scores[2] || null
        },
        year: data.year,
        region: data.region_name
    }
}
