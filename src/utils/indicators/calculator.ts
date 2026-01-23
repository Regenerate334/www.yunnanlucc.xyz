/**
 * 核心指标计算引擎
 * 实现12项土地利用核心指标计算
 * 基于谢高地2023年生态服务价值当量表
 */

import type { ProvinceYearData, LandUseIndicators } from '@/types/landuse'
import { IndicatorStatus, LandUseType } from '@/types/landuse'

// ============================================
// 常量配置
// ============================================

/**
 * 谢高地2023年生态服务价值当量表系数
 * 单位：元/hm²·年
 */
const ESV_COEFFICIENTS: Record<string, number> = {
    '耕地': 3600,
    '林地': 12000,
    '草地': 4200,
    '水域': 18000,
    '建设用地': 0,
    '未利用地': 100
}

/**
 * 云南省历年人口数据 (万人)
 * 数据来源：云南省统计年鉴
 */
const POPULATION_DATA: Record<number, number> = {
    1985: 3381.0,
    1990: 3698.0,
    1995: 3993.0,
    2000: 4287.8,
    2005: 4415.0,
    2010: 4596.6,
    2015: 4742.0,
    2020: 4721.0,
    2023: 4693.0  // 估算值
}

/**
 * 云南省耕地红线目标值
 * 2410万亩 ≈ 16066.67 km²
 */
const CROPLAND_REDLINE_TARGET = 16066.67  // km²

// ============================================
// 核心计算类
// ============================================

export class IndicatorCalculator {
    /**
     * 计算完整指标集
     */
    static calculateIndicators(
        currentData: ProvinceYearData,
        previousData?: ProvinceYearData
    ): LandUseIndicators {
        const total = this.getTotalArea(currentData)

        return {
            structureRatios: this.calculateStructureRatios(currentData, total),
            constructionExpansionRate: this.calculateExpansionRate(currentData, previousData),
            croplandOccupancyRate: this.calculateCroplandOccupancy(currentData, previousData),
            croplandRedline: this.checkCroplandRedline(currentData),
            ecologicalLandRatio: this.calculateEcologicalRatio(currentData, total),
            ecologicalSafety: this.checkEcologicalSafety(currentData, total),
            lcrpgr: this.calculateLCRPGR(currentData, previousData),
            comprehensiveDynamicDegree: this.calculateComprehensiveDynamic(currentData, previousData),
            singleDynamicDegrees: this.calculateSingleDynamics(currentData, previousData),
            esv: this.calculateESV(currentData)
        }
    }

    // =======================================
    // 辅助方法
    // =======================================

    /**
     * 计算总面积
     */
    private static getTotalArea(data: ProvinceYearData): number {
        return data.耕地 + data.林地 + data.草地 + data.水域 + data.建设用地 + data.未利用地
    }

    // =======================================
    // 结构指标
    // =======================================

    /**
     * 1. 计算土地利用结构比例
     */
    private static calculateStructureRatios(
        data: ProvinceYearData,
        total: number
    ): Record<LandUseType, number> {
        return {
            '耕地': (data.耕地 / total) * 100,
            '林地': (data.林地 / total) * 100,
            '草地': (data.草地 / total) * 100,
            '水域': (data.水域 / total) * 100,
            '建设用地': (data.建设用地 / total) * 100,
            '未利用地': (data.未利用地 / total) * 100
        } as Record<LandUseType, number>
    }

    // =======================================
    // 变化指标
    // =======================================

    /**
     * 2. 计算建设用地扩张速度
     * 单位：km²/年
     */
    private static calculateExpansionRate(
        current: ProvinceYearData,
        previous?: ProvinceYearData
    ): number {
        if (!previous) return 0

        const years = current.year - previous.year
        if (years === 0) return 0

        return (current.建设用地 - previous.建设用地) / years
    }

    /**
     * 3. 计算耕地占用率
     * 年度耕地减少 / 上年耕地面积 × 100%
     */
    private static calculateCroplandOccupancy(
        current: ProvinceYearData,
        previous?: ProvinceYearData
    ): number {
        if (!previous || previous.耕地 === 0) return 0

        const decrease = previous.耕地 - current.耕地
        if (decrease <= 0) return 0  // 没有减少

        return (decrease / previous.耕地) * 100
    }

    /**
     * 4. 耕地红线检测
     */
    private static checkCroplandRedline(data: ProvinceYearData) {
        const current = data.耕地
        const ratio = current / CROPLAND_REDLINE_TARGET

        let status: IndicatorStatus
        if (ratio >= 1.0) {
            status = IndicatorStatus.SAFE
        } else if (ratio >= 0.95) {
            status = IndicatorStatus.WARNING
        } else {
            status = IndicatorStatus.DANGER
        }

        return {
            current,
            target: CROPLAND_REDLINE_TARGET,
            ratio,
            status
        }
    }

    // =======================================
    // 生态指标
    // =======================================

    /**
     * 5. 计算生态用地占比
     * 生态用地 = 林地 + 草地 + 水域
     */
    private static calculateEcologicalRatio(
        data: ProvinceYearData,
        total: number
    ): number {
        const ecological = data.林地 + data.草地 + data.水域
        return (ecological / total) * 100
    }

    /**
     * 6. 生态安全检测
     * 生态用地占比 ≥ 80% 为安全
     */
    private static checkEcologicalSafety(
        data: ProvinceYearData,
        total: number
    ): boolean {
        return this.calculateEcologicalRatio(data, total) >= 80
    }

    // =======================================
    // 综合指标
    // =======================================

    /**
     * 7. 计算 LCRPGR (土地消耗率与人口增长率比值)
     * LCRPGR = 土地消耗率 / 人口增长率
     */
    private static calculateLCRPGR(
        current: ProvinceYearData,
        previous?: ProvinceYearData
    ): number {
        if (!previous) return 0

        const currentYear = current.year
        const previousYear = previous.year

        // 检查是否有人口数据
        if (!(currentYear in POPULATION_DATA) || !(previousYear in POPULATION_DATA)) {
            return 0
        }

        const years = currentYear - previousYear
        if (years === 0) return 0

        // 土地消耗率 (建设用地增长率)
        const lcr = ((current.建设用地 - previous.建设用地) / previous.建设用地) / years

        // 人口增长率
        const currentPop = POPULATION_DATA[currentYear]
        const previousPop = POPULATION_DATA[previousYear]
        const pgr = ((currentPop - previousPop) / previousPop) / years

        // 避免除以零
        if (Math.abs(pgr) < 0.0001) return 0

        return lcr / pgr
    }

    /**
     * 8. 计算综合动态度
     * K = ∑(ΔS_i) / (2 × ∑S_i) × 100%
     */
    private static calculateComprehensiveDynamic(
        current: ProvinceYearData,
        previous?: ProvinceYearData
    ): number {
        if (!previous) return 0

        const years = current.year - previous.year
        if (years === 0) return 0

        // 计算各地类面积变化的绝对值之和
        const deltaSum = Math.abs(current.耕地 - previous.耕地) +
            Math.abs(current.林地 - previous.林地) +
            Math.abs(current.草地 - previous.草地) +
            Math.abs(current.水域 - previous.水域) +
            Math.abs(current.建设用地 - previous.建设用地) +
            Math.abs(current.未利用地 - previous.未利用地)

        // 计算总面积
        const totalCurrent = this.getTotalArea(current)
        const totalPrevious = this.getTotalArea(previous)
        const totalSum = totalCurrent + totalPrevious

        if (totalSum === 0) return 0

        // 综合动态度 (年化)
        return (deltaSum / (2 * totalSum)) * (100 / years)
    }

    /**
     * 9. 计算单一地类动态度
     * K_i = (S_i(t2) - S_i(t1)) / S_i(t1) × 1/T × 100%
     */
    private static calculateSingleDynamics(
        current: ProvinceYearData,
        previous?: ProvinceYearData
    ): Record<LandUseType, number> {
        const result: any = {
            '耕地': 0,
            '林地': 0,
            '草地': 0,
            '水域': 0,
            '建设用地': 0,
            '未利用地': 0
        }

        if (!previous) return result

        const years = current.year - previous.year
        if (years === 0) return result

        // 计算各地类的动态度
        const landTypes: Array<keyof ProvinceYearData> = [
            LandUseType.CROPLAND,
            LandUseType.FOREST,
            LandUseType.GRASSLAND,
            LandUseType.WATER,
            LandUseType.CONSTRUCTION,
            LandUseType.UNUSED
        ]

        landTypes.forEach(type => {
            const prevValue = previous[type] as number
            const currValue = current[type] as number

            if (prevValue !== 0) {
                result[type] = ((currValue - prevValue) / prevValue) * (100 / years)
            }
        })

        return result
    }

    // =======================================
    // 生态服务价值
    // =======================================

    /**
     * 10. 计算生态服务价值 (ESV)
     * 基于谢高地2023年系数表
     * 单位：万元
     */
    private static calculateESV(data: ProvinceYearData): number {
        let totalESV = 0

        // 遍历各地类计算ESV
        Object.entries(ESV_COEFFICIENTS).forEach(([landType, coefficient]) => {
            const area = (data as any)[landType] || 0
            // km² → hm² (公顷): × 100
            // 元 → 万元: ÷ 10000
            totalESV += (area * 100 * coefficient) / 10000
        })

        return Math.round(totalESV * 100) / 100  // 保留两位小数
    }
}

// ============================================
// 辅助工具函数
// ============================================

/**
 * 获取人口数据
 */
export function getPopulationData(year: number): number | null {
    return POPULATION_DATA[year] || null
}

/**
 * 获取ESV系数
 */
export function getESVCoefficient(landType: string): number {
    return ESV_COEFFICIENTS[landType] || 0
}

/**
 * 获取耕地红线目标值
 */
export function getCroplandRedlineTarget(): number {
    return CROPLAND_REDLINE_TARGET
}
