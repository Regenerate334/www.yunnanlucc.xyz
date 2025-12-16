/**
 * Mock API 接口
 * 模拟后端API响应
 */

import { generateMockData } from './mockDataGenerator'
import type { ProvinceYearData, CityYearData, CountyYearData, APIResponse } from '@/types/landuse'

// 生成一次数据并缓存
let cachedData: ReturnType<typeof generateMockData> | null = null

function getCachedData() {
    if (!cachedData) {
        cachedData = generateMockData()
    }
    return cachedData
}

/**
 * 模拟API延迟
 */
function delay(ms: number = 300): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 创建成功响应
 */
function createSuccessResponse<T>(data: T): APIResponse<T> {
    return {
        code: 200,
        message: 'success',
        data
    }
}

/**
 * 创建失败响应
 */
function createErrorResponse(message: string): APIResponse<any> {
    return {
        code: 500,
        message,
        data: null
    }
}

// ============================================
// Mock API 接口
// ============================================

/**
 * 获取省级数据
 */
export async function fetchProvinceData(): Promise<APIResponse<ProvinceYearData[]>> {
    await delay()

    try {
        const data = getCachedData()
        return createSuccessResponse(data.province)
    } catch (error) {
        return createErrorResponse('Failed to load province data')
    }
}

/**
 * 获取地级市数据
 */
export async function fetchCityData(): Promise<APIResponse<CityYearData[]>> {
    await delay()

    try {
        const data = getCachedData()
        return createSuccessResponse(data.city)
    } catch (error) {
        return createErrorResponse('Failed to load city data')
    }
}

/**
 * 获取县级数据
 */
export async function fetchCountyData(): Promise<APIResponse<CountyYearData[]>> {
    await delay()

    try {
        const data = getCachedData()
        return createSuccessResponse(data.county)
    } catch (error) {
        return createErrorResponse('Failed to load county data')
    }
}

/**
 * 获取指定年份的省级数据
 */
export async function fetchProvinceDataByYear(year: number): Promise<APIResponse<ProvinceYearData | null>> {
    await delay()

    try {
        const data = getCachedData()
        const yearData = data.province.find(d => d.year === year)
        return createSuccessResponse(yearData || null)
    } catch (error) {
        return createErrorResponse(`Failed to load province data for year ${year}`)
    }
}

/**
 * 获取指定城市的数据
 */
export async function fetchCityDataByCode(code: string): Promise<APIResponse<CityYearData[]>> {
    await delay()

    try {
        const data = getCachedData()
        const cityData = data.city.filter(d => d.code === code)
        return createSuccessResponse(cityData)
    } catch (error) {
        return createErrorResponse(`Failed to load data for city ${code}`)
    }
}

/**
 * 获取指定县的数据
 */
export async function fetchCountyDataByCode(code: string): Promise<APIResponse<CountyYearData[]>> {
    await delay()

    try {
        const data = getCachedData()
        const countyData = data.county.filter(d => d.code === code)
        return createSuccessResponse(countyData)
    } catch (error) {
        return createErrorResponse(`Failed to load data for county ${code}`)
    }
}

// ============================================
// 导出所有API
// ============================================

export const MockAPI = {
    fetchProvinceData,
    fetchCityData,
    fetchCountyData,
    fetchProvinceDataByYear,
    fetchCityDataByCode,
    fetchCountyDataByCode
}
