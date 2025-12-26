/**
 * 土地利用结构指标计算
 * Land Use Structure Indicators
 */

import { loadLandUseConfig } from '../clcdDataLoader'

/**
 * 计算土地利用结构指标
 * @param {Object} data - 某年某地的土地利用数据
 * @param {Object} config - 土地利用配置
 * @returns {Object} 结构指标
 */
export function calculateStructureIndicators(data, config) {
    if (!data || !config) {
        return null
    }

    const landTypes = config.land_use_types.map(t => t.name_en)

    // 1. 计算总面积
    const totalArea = calculateTotalArea(data, landTypes)

    // 2. 计算各类型面积
    const composition = calculateComposition(data, landTypes)

    // 3. 计算占比
    const proportions = calculateProportions(composition, totalArea)

    // 4. 计算分类指标
    const categorizedAreas = categorizeLandUse(composition)

    return {
        totalArea,
        composition,
        proportions,
        categorizedAreas,
        metadata: {
            year: data.year,
            region: data.region_name,
            level: data.level,
            unit: data.unit || 'km²'
        }
    }
}

/**
 * 计算总面积
 */
function calculateTotalArea(data, landTypes) {
    let total = 0
    landTypes.forEach(type => {
        total += data[type] || 0
    })
    return parseFloat(total.toFixed(2))
}

/**
 * 计算各类型面积组成
 */
function calculateComposition(data, landTypes) {
    const composition = {}
    landTypes.forEach(type => {
        composition[type] = data[type] || 0
    })
    return composition
}

/**
 * 计算各类型占比
 */
function calculateProportions(composition, totalArea) {
    const proportions = {}

    if (totalArea === 0) return proportions

    Object.keys(composition).forEach(type => {
        proportions[type] = parseFloat((composition[type] / totalArea * 100).toFixed(2))
    })

    return proportions
}

/**
 * 按用途分类土地（生产-生活-生态空间）
 */
function categorizeLandUse(composition) {
    return {
        // 生产空间
        productionSpace: {
            cropland: composition.cropland || 0,
            total: composition.cropland || 0
        },

        // 生活空间
        livingSpace: {
            impervious: composition.impervious || 0,
            total: composition.impervious || 0
        },

        // 生态空间
        ecologicalSpace: {
            forest: composition.forest || 0,
            grassland: composition.grassland || 0,
            wetland: composition.wetland || 0,
            water: composition.water || 0,
            tundra: composition.snow_ice || 0,
            total: (composition.forest || 0) +
                (composition.grassland || 0) +
                (composition.wetland || 0) +
                (composition.water || 0) +
                (composition.snow_ice || 0)
        },

        // 其他空间
        otherSpace: {
            shrubland: composition.shrub || 0,
            bareland: composition.barren || 0,
            total: (composition.shrub || 0) + (composition.barren || 0)
        }
    }
}

/**
 * 计算人均土地指标（需要人口数据）
 * @param {Object} data - 土地数据
 * @param {Number} population - 人口数
 * @returns {Object} 人均指标
 */
export function calculatePerCapitaIndicators(data, population) {
    if (!data || !population || population === 0) {
        return null
    }

    const landTypes = ['cropland', 'forest', 'grassland', 'impervious']
    const perCapita = {}

    landTypes.forEach(type => {
        if (data[type]) {
            // 转换为公顷 (1 km² = 100 ha)
            perCapita[type] = parseFloat(((data[type] * 100) / population).toFixed(4))
        }
    })

    return {
        perCapitaCropland: perCapita.cropland || 0, // 人均耕地 (ha/人)
        perCapitaForest: perCapita.forest || 0,     // 人均林地
        perCapitaGreen: (perCapita.forest || 0) + (perCapita.grassland || 0), // 人均绿地
        perCapitaUrban: perCapita.impervious || 0,  // 人均建设用地
        unit: 'ha/person',
        population
    }
}

/**
 * 计算土地开发强度
 * @param {Object} data - 土地数据
 * @returns {Number} 开发强度百分比
 */
export function calculateDevelopmentIntensity(data) {
    if (!data) return 0

    const landTypes = ['cropland', 'forest', 'grassland', 'shrub',
        'wetland', 'water', 'snow_ice', 'impervious', 'barren']
    const totalArea = landTypes.reduce((sum, type) => sum + (data[type] || 0), 0)

    if (totalArea === 0) return 0

    // 开发强度 = 建设用地面积 / 总面积
    const developmentIntensity = (data.impervious || 0) / totalArea * 100

    return parseFloat(developmentIntensity.toFixed(2))
}

/**
 * 批量计算多个地区的结构指标
 * @param {Array} dataArray - 多个地区数据数组
 * @param {Object} config - 配置
 * @returns {Array} 结构指标数组
 */
export async function batchCalculateStructure(dataArray, config) {
    if (!config) {
        config = await loadLandUseConfig()
    }

    return dataArray.map(data => calculateStructureIndicators(data, config))
}
