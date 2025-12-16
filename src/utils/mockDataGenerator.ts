/**
 * Mock 数据生成器
 * 生成云南省土地利用模拟数据（省-市-县三级）
 * 数据符合云南真实趋势：耕地减少、建设用地增加、林地波动
 */

import type { ProvinceYearData, CityYearData, CountyYearData } from '@/types/landuse'

// ============================================
// 基础配置
// ============================================

/** 关键年份 */
const KEY_YEARS = [1985, 1995, 2005, 2015, 2020, 2023]

/** 云南省16个地级市 */
const CITIES = [
    { code: '530100', name: '昆明市', weight: 0.18 },
    { code: '530300', name: '曲靖市', weight: 0.12 },
    { code: '530400', name: '玉溪市', weight: 0.08 },
    { code: '530500', name: '保山市', weight: 0.07 },
    { code: '530600', name: '昭通市', weight: 0.11 },
    { code: '530700', name: '丽江市', weight: 0.05 },
    { code: '530800', name: '普洱市', weight: 0.09 },
    { code: '530900', name: '临沧市', weight: 0.06 },
    { code: '532300', name: '楚雄彝族自治州', weight: 0.07 },
    { code: '532500', name: '红河哈尼族彝族自治州', weight: 0.08 },
    { code: '532600', name: '文山壮族苗族自治州', weight: 0.07 },
    { code: '532800', name: '西双版纳傣族自治州', weight: 0.04 },
    { code: '532900', name: '大理白族自治州', weight: 0.06 },
    { code: '533100', name: '德宏傣族景颇族自治州', weight: 0.03 },
    { code: '533300', name: '怒江傈僳族自治州', weight: 0.02 },
    { code: '533400', name: '迪庆藏族自治州', weight: 0.02 }
]

/** 每个市的县数量（简化版，实际总共129个县） */
const COUNTIES_PER_CITY: Record<string, number> = {
    '530100': 14, // 昆明市
    '530300': 9,  // 曲靖市
    '530400': 9,  // 玉溪市
    '530500': 5,  // 保山市
    '530600': 11, // 昭通市
    '530700': 5,  // 丽江市
    '530800': 10, // 普洱市
    '530900': 8,  // 临沧市
    '532300': 10, // 楚雄州
    '532500': 13, // 红河州
    '532600': 8,  // 文山州
    '532800': 3,  // 西双版纳州
    '532900': 12, // 大理州
    '533100': 5,  // 德宏州
    '533300': 4,  // 怒江州
    '533400': 3   // 迪庆州
}

// ============================================
// 省级数据生成
// ============================================

/**
 * 生成省级数据
 * 基准值基于云南省真实情况
 */
export function generateProvinceData(): ProvinceYearData[] {
    const data: ProvinceYearData[] = []

    // 2023年真实基准值（km²）
    const base2023 = {
        耕地: 80000,      // 实际约8万km²
        林地: 240000,     // 实际约24万km²（云南森林覆盖率65%）
        草地: 22000,      // 实际约2.2万km²
        水域: 3000,       // 实际约0.3万km²
        建设用地: 5000,   // 实际约0.5万km²（快速增长）
        未利用地: 4000    // 实际约0.4万km²
    }

    KEY_YEARS.forEach((year, idx) => {
        const progress = idx / (KEY_YEARS.length - 1)  // 0 到 1
        const yearOffset = (2023 - year) / (2023 - 1985)  // 1985=1.0, 2023=0.0

        data.push({
            year,
            // 耕地：持续减少（1985: 85000 → 2023: 80000）
            耕地: base2023.耕地 + 5000 * yearOffset - 800 * Math.sin(progress * Math.PI),

            // 林地：小幅波动增长
            林地: base2023.林地 - 3000 * yearOffset + 2000 * Math.sin(progress * Math.PI * 2),

            // 草地：缓慢减少
            草地: base2023.草地 + 3000 * yearOffset,

            // 水域：略有增加
            水域: base2023.水域 - 200 * yearOffset,

            // 建设用地：快速增长（1985: 1500 → 2023: 5000）
            建设用地: base2023.建设用地 - 3500 * yearOffset,

            // 未利用地：减少
            未利用地: base2023.未利用地 + 1000 * yearOffset
        })
    })

    return data
}

// ============================================
// 地级市数据生成
// ============================================

/**
 * 生成地级市数据
 */
export function generateCityData(): CityYearData[] {
    const provinceData = generateProvinceData()
    const cityData: CityYearData[] = []

    provinceData.forEach(pData => {
        let allocated = {
            耕地: 0,
            林地: 0,
            草地: 0,
            水域: 0,
            建设用地: 0,
            未利用地: 0
        }

        CITIES.forEach((city, idx) => {
            // 最后一个城市使用剩余值，避免舍入误差
            const isLast = idx === CITIES.length - 1

            // 基础权重
            let weight = city.weight

            // 添加一些随机变化使数据更真实
            const variation = 1 + (Math.random() - 0.5) * 0.1  // ±5%

            const cityYearData: CityYearData = {
                year: pData.year,
                code: city.code,
                name: city.name,
                耕地: 0,
                林地: 0,
                草地: 0,
                水域: 0,
                建设用地: 0,
                未利用地: 0
            }

            // 分配各地类面积
            Object.keys(allocated).forEach(landType => {
                const key = landType as keyof typeof allocated
                if (isLast) {
                    // 最后一个城市用剩余值
                    cityYearData[key] = pData[key] - allocated[key]
                } else {
                    // 昆明市建设用地占比更高
                    let adjustedWeight = weight
                    if (city.code === '530100' && key === '建设用地') {
                        adjustedWeight = weight * 1.5
                    }
                    // 林区（普洱、临沧）林地占比更高
                    if (['530800', '530900'].includes(city.code) && key === '林地') {
                        adjustedWeight = weight * 1.3
                    }

                    const value = Math.round(pData[key] * adjustedWeight * variation)
                    cityYearData[key] = value
                    allocated[key] += value
                }
            })

            cityData.push(cityYearData)
        })
    })

    return cityData
}

// ============================================
// 县级数据生成
// ============================================

/**
 * 生成县级数据（简化版）
 */
export function generateCountyData(): CountyYearData[] {
    const cityData = generateCityData()
    const countyData: CountyYearData[] = []

    cityData.forEach(cData => {
        const countyCount = COUNTIES_PER_CITY[cData.code] || 5

        let allocated = {
            耕地: 0,
            林地: 0,
            草地: 0,
            水域: 0,
            建设用地: 0,
            未利用地: 0
        }

        for (let i = 0; i < countyCount; i++) {
            const isLast = i === countyCount - 1
            const countyCode = `${cData.code.slice(0, 4)}${(i + 1).toString().padStart(2, '0')}`

            const countyYearData: CountyYearData = {
                year: cData.year,
                code: countyCode,
                name: `${cData.name.replace('市', '').replace('州', '').replace('自治', '')}${i + 1}县`,
                cityCode: cData.code,
                耕地: 0,
                林地: 0,
                草地: 0,
                水域: 0,
                建设用地: 0,
                未利用地: 0
            }

            Object.keys(allocated).forEach(landType => {
                const key = landType as keyof typeof allocated
                if (isLast) {
                    countyYearData[key] = cData[key] - allocated[key]
                } else {
                    const weight = 1 / countyCount
                    const variation = 1 + (Math.random() - 0.5) * 0.2  // ±10%
                    const value = Math.round(cData[key] * weight * variation)
                    countyYearData[key] = value
                    allocated[key] += value
                }
            })

            countyData.push(countyYearData)
        }
    })

    return countyData
}

// ============================================
// 统一数据生成
// ============================================

/**
 * 生成所有Mock数据
 */
export function generateMockData() {
    console.log('[Mock] 开始生成数据...')

    const province = generateProvinceData()
    const city = generateCityData()
    const county = generateCountyData()

    console.log(`[Mock] 生成完成:`)
    console.log(`  - 省级数据: ${province.length} 条`)
    console.log(`  - 地级市数据: ${city.length} 条`)
    console.log(`  - 县级数据: ${county.length} 条`)

    return {
        province,
        city,
        county
    }
}

// ============================================
// 数据验证
// ============================================

/**
 * 验证数据完整性
 */
export function validateMockData() {
    const data = generateMockData()

    // 验证年份
    const years = [...new Set(data.province.map(d => d.year))]
    console.log('可用年份:', years)

    // 验证总面积
    data.province.forEach(pData => {
        const total = pData.耕地 + pData.林地 + pData.草地 + pData.水域 + pData.建设用地 + pData.未利用地
        console.log(`${pData.year}年总面积: ${total.toFixed(0)} km²`)
    })

    // 验证城市数量
    const cityCodes = [...new Set(data.city.map(d => d.code))]
    console.log(`地级市数量: ${cityCodes.length}`)

    return data
}
