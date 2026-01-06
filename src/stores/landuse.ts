/**
 * 土地利用数据 Store
 * 管理核心数据状态和业务逻辑
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
    ProvinceYearData,
    CityYearData,
    CountyYearData,
    CompareMode,
    LoadingState
} from '@/types/landuse'
import { AdminLevel, LandUseType } from '@/types/landuse'

export const useLandUseStore = defineStore('landuse', () => {
    // ============================================
    // 状态 (State)
    // ============================================

    // 数据集
    const provinceData = ref<ProvinceYearData[]>([])
    const cityData = ref<CityYearData[]>([])
    const countyData = ref<CountyYearData[]>([])

    // 当前选择
    const selectedYear = ref<number>(2023)
    const selectedLevel = ref<AdminLevel>('province' as AdminLevel)
    const selectedCode = ref<string | null>(null)
    const selectedLandType = ref<LandUseType>('建设用地' as LandUseType)

    // 交互状态
    const compareMode = ref<CompareMode>({
        enabled: false,
        year1: 2020,
        year2: 2023
    })

    // 加载状态
    const loadingState = ref<LoadingState>({
        loading: false,
        error: null,
        loaded: false
    })

    // ============================================
    // 计算属性 (Getters)
    // ============================================

    /**
     * 当前年份的省级数据
     */
    const currentYearProvinceData = computed(() => {
        return provinceData.value.find(d => d.year === selectedYear.value)
    })

    /**
     * 当前选中区域的数据
     */
    const currentSelectedData = computed(() => {
        if (selectedLevel.value === 'province') {
            return provinceData.value.find(d => d.year === selectedYear.value)
        } else if (selectedLevel.value === 'city') {
            return cityData.value.find(d =>
                d.year === selectedYear.value && d.code === selectedCode.value
            )
        } else {
            return countyData.value.find(d =>
                d.year === selectedYear.value && d.code === selectedCode.value
            )
        }
    })

    /**
     * 时间序列数据（当前选中区域的所有年份）
     */
    const timeSeriesData = computed(() => {
        if (selectedLevel.value === 'province') {
            return provinceData.value.sort((a, b) => a.year - b.year)
        } else if (selectedLevel.value === 'city') {
            return cityData.value
                .filter(d => d.code === selectedCode.value)
                .sort((a, b) => a.year - b.year)
        } else {
            return countyData.value
                .filter(d => d.code === selectedCode.value)
                .sort((a, b) => a.year - b.year)
        }
    })

    /**
     * 可用年份列表
     */
    const availableYears = computed(() => {
        const years = [...new Set(provinceData.value.map(d => d.year))]
        return years.sort((a, b) => a - b)
    })

    /**
     * 上一年度数据（用于计算动态度）
     */
    const previousYearData = computed(() => {
        const currentIndex = availableYears.value.indexOf(selectedYear.value)
        if (currentIndex > 0) {
            const previousYear = availableYears.value[currentIndex - 1]

            if (selectedLevel.value === 'province') {
                return provinceData.value.find(d => d.year === previousYear)
            } else if (selectedLevel.value === 'city') {
                return cityData.value.find(d =>
                    d.year === previousYear && d.code === selectedCode.value
                )
            } else {
                return countyData.value.find(d =>
                    d.year === previousYear && d.code === selectedCode.value
                )
            }
        }
        return null
    })

    /**
     * 对比模式的两个年份数据
     */
    const compareModeData = computed(() => {
        if (!compareMode.value.enabled) return null

        const data1 = provinceData.value.find(d => d.year === compareMode.value.year1)
        const data2 = provinceData.value.find(d => d.year === compareMode.value.year2)

        return data1 && data2 ? { year1Data: data1, year2Data: data2 } : null
    })

    /**
     * 当前选中地类在所有地级市的分布
     */
    const selectedTypeCityDistribution = computed(() => {
        if (!selectedLandType.value) return []

        return cityData.value
            .filter(d => d.year === selectedYear.value)
            .map(city => ({
                code: city.code,
                name: city.name,
                value: city[selectedLandType.value]
            }))
            .sort((a, b) => b.value - a.value)
    })

    // ============================================
    // 方法 (Actions)
    // ============================================

    /**
     * 加载所有数据
     */
    async function loadData() {
        loadingState.value.loading = true
        loadingState.value.error = null

        try {
            // 尝试从API加载
            const [provinceRes, cityRes, countyRes] = await Promise.all([
                fetch('/api/landuse/province').then(r => {
                    if (!r.ok) throw new Error('Province data load failed')
                    return r.json()
                }),
                fetch('/api/landuse/city').then(r => {
                    if (!r.ok) throw new Error('City data load failed')
                    return r.json()
                }),
                fetch('/api/landuse/county').then(r => {
                    if (!r.ok) throw new Error('County data load failed')
                    return r.json()
                })
            ])
            provinceData.value = provinceRes
            cityData.value = cityRes
            countyData.value = countyRes
            loadingState.value.loaded = true
        } catch (error) {
            console.error('API 加载失败:', error)
            loadingState.value.error = error as Error
        } finally {
            loadingState.value.loading = false
        }
    }

    /**
     * 选择行政区域
     */
    function selectRegion(level: AdminLevel, code: string | null = null) {
        selectedLevel.value = level
        selectedCode.value = code
    }

    /**
     * 设置年份
     */
    function setYear(year: number) {
        if (availableYears.value.includes(year)) {
            selectedYear.value = year
        }
    }

    /**
     * 设置选中的土地类型
     */
    function setLandType(type: LandUseType) {
        selectedLandType.value = type
    }

    /**
     * 切换对比模式
     */
    function toggleCompareMode(year1?: number, year2?: number) {
        compareMode.value.enabled = !compareMode.value.enabled

        if (year1 !== undefined) {
            compareMode.value.year1 = year1
        }
        if (year2 !== undefined) {
            compareMode.value.year2 = year2
        }
    }

    /**
     * 重置选择
     */
    function resetSelection() {
        selectedLevel.value = 'province' as AdminLevel
        selectedCode.value = null
        selectedYear.value = 2023
        selectedLandType.value = '建设用地' as LandUseType
        compareMode.value.enabled = false
    }

    // ============================================
    // 返回 Store API
    // ============================================

    return {
        // 状态
        provinceData,
        cityData,
        countyData,
        selectedYear,
        selectedLevel,
        selectedCode,
        selectedLandType,
        compareMode,
        loadingState,

        // 计算属性
        currentYearProvinceData,
        currentSelectedData,
        timeSeriesData,
        availableYears,
        previousYearData,
        compareModeData,
        selectedTypeCityDistribution,

        // 方法
        loadData,
        selectRegion,
        setYear,
        setLandType,
        toggleCompareMode,
        resetSelection
    }
})
