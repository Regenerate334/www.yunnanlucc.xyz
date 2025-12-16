/**
 * 生态环境指标计算
 * Ecological Environment Indicators
 */

/**
 * 计算生态空间指标
 * @param {Object} data - 土地利用数据
 * @returns {Object} 生态空间指标
 */
export function calculateEcologicalSpaceIndicators(data) {
    if (!data) return null

    const landTypes = ['cropland', 'forest', 'grassland', 'shrubland',
        'wetland', 'water', 'tundra', 'impervious', 'bareland']

    // 计算总面积
    const totalArea = landTypes.reduce((sum, type) => sum + (data[type] || 0), 0)

    if (totalArea === 0) return null

    // 生态用地（森林+草地+湿地+水体+苔原）
    const ecologicalLand = (data.forest || 0) +
        (data.grassland || 0) +
        (data.wetland || 0) +
        (data.water || 0) +
        (data.tundra || 0)

    // 森林覆盖率
    const forestCoverage = (data.forest || 0) / totalArea * 100

    // 植被覆盖率（森林+草地+灌木）
    const vegetationCoverage = ((data.forest || 0) +
        (data.grassland || 0) +
        (data.shrubland || 0)) / totalArea * 100

    // 水域面积占比
    const waterRatio = ((data.water || 0) + (data.wetland || 0)) / totalArea * 100

    return {
        ecologicalLand: parseFloat(ecologicalLand.toFixed(2)),
        ecologicalRatio: parseFloat((ecologicalLand / totalArea * 100).toFixed(2)),
        forestCoverage: parseFloat(forestCoverage.toFixed(2)),
        vegetationCoverage: parseFloat(vegetationCoverage.toFixed(2)),
        waterRatio: parseFloat(waterRatio.toFixed(2)),
        composition: {
            forest: data.forest || 0,
            grassland: data.grassland || 0,
            wetland: data.wetland || 0,
            water: data.water || 0,
            tundra: data.tundra || 0
        },
        metadata: {
            year: data.year,
            region: data.region_name,
            totalArea,
            unit: '%'
        }
    }
}

/**
 * 评估生态风险
 * @param {Object} dataT1 - 初期数据
 * @param {Object} dataT2 - 末期数据
 * @returns {Object} 生态风险评估
 */
export function assessEcologicalRisk(dataT1, dataT2) {
    if (!dataT1 || !dataT2) return null

    const risks = []

    // 1. 耕地向建设用地转换风险
    const croplandToUrban = (dataT1.cropland || 0) - (dataT2.cropland || 0)
    const urbanIncrease = (dataT2.impervious || 0) - (dataT1.impervious || 0)

    if (croplandToUrban > 0 && urbanIncrease > 0) {
        risks.push({
            type: 'cropland_loss',
            severity: croplandToUrban > 100 ? 'high' : croplandToUrban > 50 ? 'medium' : 'low',
            value: croplandToUrban,
            description: '耕地向建设用地转换'
        })
    }

    // 2. 森林减少风险
    const forestLoss = (dataT1.forest || 0) - (dataT2.forest || 0)
    if (forestLoss > 0) {
        risks.push({
            type: 'forest_loss',
            severity: forestLoss > 200 ? 'high' : forestLoss > 100 ? 'medium' : 'low',
            value: forestLoss,
            description: '森林面积减少'
        })
    }

    // 3. 湿地丧失风险
    const wetlandLoss = (dataT1.wetland || 0) - (dataT2.wetland || 0)
    if (wetlandLoss > 0) {
        risks.push({
            type: 'wetland_loss',
            severity: wetlandLoss > 10 ? 'high' : wetlandLoss > 5 ? 'medium' : 'low',
            value: wetlandLoss,
            description: '湿地面积丧失'
        })
    }

    // 4. 生态空间总体减少风险
    const eco1 = (dataT1.forest || 0) + (dataT1.grassland || 0) +
        (dataT1.wetland || 0) + (dataT1.water || 0)
    const eco2 = (dataT2.forest || 0) + (dataT2.grassland || 0) +
        (dataT2.wetland || 0) + (dataT2.water || 0)
    const ecoLoss = eco1 - eco2

    if (ecoLoss > 0) {
        risks.push({
            type: 'ecological_space_loss',
            severity: ecoLoss > 300 ? 'high' : ecoLoss > 150 ? 'medium' : 'low',
            value: ecoLoss,
            description: '生态空间总体减少'
        })
    }

    // 综合风险等级
    const highRiskCount = risks.filter(r => r.severity === 'high').length
    const mediumRiskCount = risks.filter(r => r.severity === 'medium').length

    let overallRisk = 'low'
    if (highRiskCount >= 2 || (highRiskCount === 1 && mediumRiskCount >= 2)) {
        overallRisk = 'high'
    } else if (highRiskCount === 1 || mediumRiskCount >= 2) {
        overallRisk = 'medium'
    }

    return {
        overallRisk,
        riskCount: risks.length,
        risks,
        period: `${dataT1.year}-${dataT2.year}`,
        recommendation: generateRiskRecommendation(overallRisk, risks)
    }
}

/**
 * 生成风险建议
 */
function generateRiskRecommendation(overallRisk, risks) {
    if (overallRisk === 'low') {
        return '生态状况良好，继续保持当前保护措施'
    }

    const recommendations = []
    risks.forEach(risk => {
        switch (risk.type) {
            case 'cropland_loss':
                recommendations.push('加强耕地保护，严格控制城市扩张')
                break
            case 'forest_loss':
                recommendations.push('实施退耕还林，加强森林保护')
                break
            case 'wetland_loss':
                recommendations.push('建立湿地保护区，禁止排水开发')
                break
            case 'ecological_space_loss':
                recommendations.push('划定生态保护红线，优化国土空间格局')
                break
        }
    })

    return [...new Set(recommendations)].join('；')
}

/**
 * 计算生态保护绩效
 * @param {Object} dataT1 - 初期数据
 * @param {Object} dataT2 - 末期数据
 * @returns {Object} 保护绩效
 */
export function calculateProtectionPerformance(dataT1, dataT2) {
    if (!dataT1 || !dataT2) return null

    const yearSpan = dataT2.year - dataT1.year
    if (yearSpan === 0) return null

    // 森林增长
    const forestGrowth = (dataT2.forest || 0) - (dataT1.forest || 0)
    const forestGrowthRate = (dataT1.forest || 0) > 0 ?
        forestGrowth / (dataT1.forest || 1) * 100 : 0

    // 草地变化
    const grasslandChange = (dataT2.grassland || 0) - (dataT1.grassland || 0)

    // 湿地保护
    const wetlandProtection = (dataT2.wetland || 0) >= (dataT1.wetland || 0)

    // 生态空间总量
    const eco1 = (dataT1.forest || 0) + (dataT1.grassland || 0) + (dataT1.wetland || 0)
    const eco2 = (dataT2.forest || 0) + (dataT2.grassland || 0) + (dataT2.wetland || 0)
    const ecoSpaceChange = eco2 - eco1

    // 评分系统 (0-100)
    let score = 50 // 基础分

    if (forestGrowth > 0) score += 15
    else if (forestGrowth < -50) score -= 15

    if (grasslandChange > 0) score += 10
    else if (grasslandChange < -50) score -= 10

    if (wetlandProtection) score += 15
    else score -= 15

    if (ecoSpaceChange > 0) score += 10
    else if (ecoSpaceChange < 0) score -= 10

    score = Math.max(0, Math.min(100, score))

    let grade = 'C'
    if (score >= 85) grade = 'A'
    else if (score >= 70) grade = 'B'
    else if (score >= 60) grade = 'C'
    else grade = 'D'

    return {
        score: parseFloat(score.toFixed(1)),
        grade,
        indicators: {
            forestGrowth: parseFloat(forestGrowth.toFixed(2)),
            forestGrowthRate: parseFloat(forestGrowthRate.toFixed(2)),
            grasslandChange: parseFloat(grasslandChange.toFixed(2)),
            wetlandProtected: wetlandProtection,
            ecoSpaceChange: parseFloat(ecoSpaceChange.toFixed(2))
        },
        period: `${dataT1.year}-${dataT2.year}`,
        yearSpan
    }
}
