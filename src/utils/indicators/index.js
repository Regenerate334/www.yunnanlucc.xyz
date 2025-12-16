/**
 * 国土空间规划监测指标计算工具集
 * Territorial Spatial Planning Monitoring Indicators
 */

// 土地利用结构指标
export {
    calculateStructureIndicators,
    calculatePerCapitaIndicators,
    calculateDevelopmentIntensity,
    batchCalculateStructure
} from './landUseStructure'

// 土地利用变化指标
export {
    calculateDynamicDegree,
    calculateComprehensiveDynamicDegree,
    generateTransferMatrix,
    calculateChangeRate,
    detectChangeHotspots,
    analyzeTrend
} from './landUseChange'

// 生态环境指标
export {
    calculateEcologicalSpaceIndicators,
    assessEcologicalRisk,
    calculateProtectionPerformance
} from './ecologicalIndicators'

// 集约利用指标
export {
    calculateUrbanExpansionIndicators,
    calculateUrbanCompactness,
    calculateLandUseEfficiency,
    calculateUrbanElasticityCoefficient,
    comprehensiveIntensiveEvaluation
} from './intensiveUtilization'

/**
 * 一键计算所有指标
 * @param {Object|Array} data - 单个数据或数据数组
 * @param {Object} options - 可选参数 {config, socioEconomic: {gdp, population, urbanPopulation}}
 * @returns {Object} 所有指标
 */
export async function calculateAllIndicators(data, options = {}) {
    const { config, socioEconomic } = options

    // 导入所有helper函数
    const {
        calculateStructureIndicators,
        calculateDevelopmentIntensity,
        calculatePerCapitaIndicators
    } = await import('./landUseStructure')

    const {
        calculateEcologicalSpaceIndicators
    } = await import('./ecologicalIndicators')

    const {
        calculateLandUseEfficiency,
        comprehensiveIntensiveEvaluation
    } = await import('./intensiveUtilization')

    // 单个数据对象
    if (!Array.isArray(data)) {
        const result = {
            metadata: {
                year: data.year,
                region: data.region_name,
                level: data.level
            },
            structure: calculateStructureIndicators(data, config),
            development: {
                intensity: calculateDevelopmentIntensity(data)
            },
            ecological: calculateEcologicalSpaceIndicators(data)
        }

        // 如果有社会经济数据
        if (socioEconomic) {
            const { gdp, population, urbanPopulation } = socioEconomic

            if (population) {
                result.perCapita = calculatePerCapitaIndicators(data, population)
            }

            if (gdp || population) {
                result.efficiency = calculateLandUseEfficiency(data, gdp, population)
            }

            if (gdp && population && urbanPopulation) {
                result.intensive = comprehensiveIntensiveEvaluation(data, socioEconomic)
            }
        }

        return result
    }

    // 时间序列数据
    if (data.length >= 2) {
        const {
            calculateDynamicDegree,
            calculateComprehensiveDynamicDegree,
            analyzeTrend
        } = await import('./landUseChange')

        const {
            assessEcologicalRisk,
            calculateProtectionPerformance
        } = await import('./ecologicalIndicators')

        const {
            calculateUrbanExpansionIndicators,
            calculateUrbanElasticityCoefficient
        } = await import('./intensiveUtilization')

        const sortedData = [...data].sort((a, b) => a.year - b.year)
        const t1 = sortedData[0]
        const t2 = sortedData[sortedData.length - 1]

        const result = {
            metadata: {
                period: `${t1.year}-${t2.year}`,
                region: t1.region_name,
                level: t1.level,
                dataPoints: data.length
            },
            change: {
                dynamicDegree: calculateDynamicDegree(t1, t2),
                comprehensiveDegree: calculateComprehensiveDynamicDegree(t1, t2)
            },
            ecological: {
                risk: assessEcologicalRisk(t1, t2),
                protection: calculateProtectionPerformance(t1, t2)
            },
            urban: calculateUrbanExpansionIndicators(sortedData)
        }

        // 趋势分析（仅对主要土地类型）
        result.trends = {}
        const majorTypes = ['cropland', 'forest', 'grassland', 'impervious']
        majorTypes.forEach(type => {
            result.trends[type] = analyzeTrend(sortedData, type)
        })

        // 如果有GDP数据，计算弹性系数
        if (socioEconomic?.gdp && Array.isArray(socioEconomic.gdp) &&
            socioEconomic.gdp.length >= 2) {
            const gdpT1 = socioEconomic.gdp[0]
            const gdpT2 = socioEconomic.gdp[socioEconomic.gdp.length - 1]
            result.elasticity = calculateUrbanElasticityCoefficient(t1, t2, gdpT1, gdpT2)
        }

        return result
    }

    return null
}

/**
 * 导出所有指标计算结果为报告格式
 * @param {Object} indicators - 指标结果
 * @returns {String} 格式化报告
 */
export function generateIndicatorReport(indicators) {
    if (!indicators) return ''

    const lines = []
    lines.push('=' * 50)
    lines.push('国土空间土地利用监测指标报告')
    lines.push('Territorial Spatial Planning Monitoring Report')
    lines.push('='.repeat(50))
    lines.push('')

    // 元数据
    if (indicators.metadata) {
        const meta = indicators.metadata
        lines.push(`地区: ${meta.region || 'N/A'}`)
        lines.push(`层级: ${meta.level || 'N/A'}`)
        if (meta.year) {
            lines.push(`年份: ${meta.year}`)
        } else if (meta.period) {
            lines.push(`时期: ${meta.period}`)
        }
        lines.push('')
    }

    // 结构指标
    if (indicators.structure) {
        lines.push('【土地利用结构】')
        const struct = indicators.structure
        lines.push(`总面积: ${struct.totalArea} km²`)
        if (struct.categorizedAreas) {
            const cat = struct.categorizedAreas
            lines.push(`- 生产空间: ${cat.productionSpace.total.toFixed(2)} km²`)
            lines.push(`- 生活空间: ${cat.livingSpace.total.toFixed(2)} km²`)
            lines.push(`- 生态空间: ${cat.ecologicalSpace.total.toFixed(2)} km²`)
        }
        lines.push('')
    }

    // 生态指标
    if (indicators.ecological) {
        const eco = indicators.ecological
        if (eco.ecologicalRatio !== undefined) {
            lines.push('【生态环境】')
            lines.push(`生态用地占比: ${eco.ecologicalRatio}%`)
            lines.push(`森林覆盖率: ${eco.forestCoverage}%`)
            lines.push(`植被覆盖率: ${eco.vegetationCoverage}%`)
            lines.push('')
        } else if (eco.risk) {
            lines.push('【生态风险评估】')
            lines.push(`综合风险等级: ${eco.risk.overallRisk}`)
            lines.push(`风险数量: ${eco.risk.riskCount}`)
            if (eco.risk.recommendation) {
                lines.push(`建议: ${eco.risk.recommendation}`)
            }
            lines.push('')
        }
    }

    // 变化指标
    if (indicators.change) {
        lines.push('【土地利用变化】')
        if (indicators.change.comprehensiveDegree) {
            const comp = indicators.change.comprehensiveDegree
            lines.push(`综合动态度: ${comp.value}${comp.unit}`)
        }
        lines.push('')
    }

    // 集约利用
    if (indicators.intensive) {
        lines.push('【集约利用评价】')
        lines.push(`综合评分: ${indicators.intensive.finalScore}`)
        lines.push(`等级: ${indicators.intensive.grade}`)
        lines.push('')
    }

    lines.push('='.repeat(50))
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`)

    return lines.join('\n')
}
