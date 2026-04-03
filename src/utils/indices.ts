
/**
 * 土地利用监测指标计算工具函数
 * Contains formulas for:
 * 1. Single Land Use Dynamic Degree (K)
 * 2. Comprehensive Land Use Dynamic Degree (LC)
 * 3. Land Use Degree Index (LUDI)
 * 4. Ecological Service Value (ESV)
 */

// 土地利用类型定义
export type LandUseType = 'Cropland' | 'Forest' | 'Shrub' | 'Grassland' | 'Water' | 'Snow/Ice' | 'Barren' | 'Impervious' | 'Wetland';

// 土地利用数据接口
export interface LandUseData {
    year: number;
    [key: string]: number | string; // 允许动态键值，值为面积
}

/**
 * 1. 单一土地利用动态度 (Single Land Use Dynamic Degree)
 * 反映特定土地利用类型在一定时间段内的数量变化情况
 * 公式: K = (Ub - Ua) / Ua * (1 / T) * 100%
 * @param startArea 研究期初某种土地利用类型的面积
 * @param endArea 研究期末某种土地利用类型的面积
 * @param years 研究时段长 (年)
 * @returns 动态度百分比 (不带%)
 */
export function calculateSingleDynamicDegree(startArea: number, endArea: number, years: number): number {
    if (startArea === 0 || years === 0) return 0;
    return ((endArea - startArea) / startArea) * (1 / years) * 100;
}

/**
 * 2. 综合土地利用动态度 (Comprehensive Land Use Dynamic Degree)
 * 反映区域土地利用变化的综合剧烈程度
 * 公式: LC = [Σ(ΔLUi-j) / (2 * ΣLUi)] * (1 / T) * 100%
 * 简化版公式 (基于面积变化绝对值): LC = (Σ|Ubi - Uai| / 2 * ΣUai) * (1 / T) * 100%
 * @param startData 期初各类型面积对象
 * @param endData 期末各类型面积对象
 * @param years 研究时段长
 * @returns 综合动态度百分比
 */
export function calculateComprehensiveDynamicDegree(
    startData: Record<LandUseType, number>,
    endData: Record<LandUseType, number>,
    years: number
): number {
    if (years === 0) return 0;

    let totalChange = 0;
    let totalStartArea = 0;

    const types = Object.keys(startData) as LandUseType[];

    types.forEach(type => {
        const start = startData[type] || 0;
        const end = endData[type] || 0;
        totalChange += Math.abs(end - start);
        totalStartArea += start;
    });

    if (totalStartArea === 0) return 0;

    return (totalChange / (2 * totalStartArea)) * (1 / years) * 100;
}

/**
 * 3. 土地利用程度综合指数 (Land Use Degree Index, LUDI)
 * 反映人类活动对土地利用的广度和深度
 * 公式: L = 100 * Σ(Ai * Ci)
 * Ai: 第i级土地利用程度分级指数
 * Ci: 第i级土地利用程度分级面积百分比
 * 
 * 分级建议 (庄大方 & 刘纪远):
 * 1级 (未利用): Barren, Snow/Ice
 * 2级 (绿地/水域): Forest, Grassland, Shrub, Water, Wetland
 * 3级 (农业): Cropland
 * 4级 (建设): Impervious
 */
const LUDI_WEIGHTS: Record<string, number> = {
    'Barren': 1,
    'Snow/Ice': 1,
    'Forest': 2,
    'Grassland': 2,
    'Shrub': 2,
    'Water': 2,
    'Wetland': 2,
    'Cropland': 3,
    'Impervious': 4
};

export function calculateLUDI(data: Record<LandUseType, number>): number {
    let totalArea = 0;
    let weightedSum = 0;

    (Object.keys(data) as LandUseType[]).forEach(type => {
        const area = data[type] || 0;
        const weight = LUDI_WEIGHTS[type] || 1; // 默认为1
        totalArea += area;
        weightedSum += area * weight;
    });

    if (totalArea === 0) return 0;

    return 100 * (weightedSum / totalArea);
}

/**
 * 4. 生态服务价值 (Ecological Service Value, ESV)
 * 基于谢高地等人 (2015) 中国生态系统服务价值当量因子表
 * 当量因子 (Equivalent Factors):
 * Cropland: 1.0, Forest: 5.04, Shrub: 2.0, Grassland: 1.57, Water: 13.22, Wetland: 13.5, Barren: 0.1, Snow/Ice: 0, Impervious: 0
 */
const ESV_COEFFICIENTS: Record<LandUseType, number> = {
    'Cropland': 1.00,
    'Forest': 5.04,
    'Shrub': 2.0,
    'Grassland': 1.57,
    'Water': 13.22,
    'Wetland': 13.5,
    'Barren': 0.1,
    'Snow/Ice': 0,
    'Impervious': 0
};

export function calculateESV(data: Record<LandUseType, number>): number {
    let totalESV = 0;
    (Object.keys(data) as LandUseType[]).forEach(type => {
        const area = data[type] || 0;
        // 采用当量因子 * 面积 (km2 -> hm2 转换) 进行计算
        const areaInHm2 = area * 100;
        const coeff = ESV_COEFFICIENTS[type] || 0;
        totalESV += areaInHm2 * coeff;
    });
    return totalESV;
}

/**
 * 辅助函数：将后端数据格式转换为计算所需的 Record<Type, Area> 格式
 */
export function transformDataForCalculation(apiData: any): Record<LandUseType, number> {
    const mapping: Record<string, LandUseType> = {
        'cropland': 'Cropland',
        'forest': 'Forest',
        'shrub': 'Shrub',
        'grassland': 'Grassland',
        'water': 'Water',
        'snow_ice': 'Snow/Ice',
        'barren': 'Barren',
        'impervious': 'Impervious',
        'wetland': 'Wetland'
    };

    const result: any = {};

    // 如果是数组格式 (来自 /api/clcd/:year/summary)
    if (Array.isArray(apiData)) {
        apiData.forEach(item => {
            const name = item.class_name || item.landuse_type;
            if (name) {
                // 尝试直接匹配或通过 mapping 匹配
                const type = (Object.values(mapping).includes(name as LandUseType) ? name : mapping[name.toLowerCase()]) as LandUseType;
                if (type) {
                    result[type] = Number(item.area_km2 || item.area || 0);
                }
            }
        });
        return result;
    }

    // 如果是对象格式 (来自 /api/clcd/province)
    Object.keys(apiData).forEach(key => {
        const mappedKey = mapping[key.toLowerCase()];
        if (mappedKey) {
            result[mappedKey] = Number(apiData[key]) || 0;
        } else if (Object.values(mapping).includes(key as LandUseType)) {
            result[key] = Number(apiData[key]) || 0;
        }
    });

    return result;
}

/**
 * 5. 香农多样性指数 (Shannon's Diversity Index, SHDI)
 * 反映景观斑块类型的丰富度和均匀度
 * 公式: H = -Σ(Pi * ln(Pi))
 * Pi: 第i类土地利用类型的面积比例
 */
export function calculateSHDI(data: Record<LandUseType, number>): number {
    let totalArea = 0;
    const areas: number[] = [];

    Object.values(data).forEach(area => {
        if (area > 0) {
            totalArea += area;
            areas.push(area);
        }
    });

    if (totalArea === 0) return 0;

    let shdi = 0;
    areas.forEach(area => {
        const p = area / totalArea;
        shdi += p * Math.log(p);
    });

    return -shdi;
}
