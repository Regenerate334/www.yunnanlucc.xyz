import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useGlobalStore = defineStore('global', () => {
    // State
    const scope = ref({ level: 'province', code: '530000', name: '云南省' }) // 使用标准代码 530000
    const timeMode = ref('single') // 'single' | 'range'
    const currentYear = ref(1985)
    const range = ref([1985, 2023])
    const yearsAll = ref([1985, ...Array.from({ length: 2023 - 1990 + 1 }, (_, i) => 1990 + i)])
    const selectedClasses = ref(['Cropland', 'Forest', 'Shrub', 'Grassland', 'Water', 'Snow/Ice', 'Barren', 'Impervious', 'Wetland'])
    const metricMode = ref('absolute') // 'absolute' | 'percent'
    const activePanel = ref<string | null>(null) // Used to track which exclusive panel is open ('transfer', 'time', etc.)
    const legendData = ref<any>(null) // Used for analysis legend

    // 新增：全局图层互斥状态
    const activeLayer = ref<string>('clcd') // 'clcd' | 'county' | 'grid' | 'land_transfer'
    const previousLayer = ref<string>('clcd') // 记录进入分析前的图层

    // 新增：分析专题互斥状态
    const activeTheme = ref<string | null>(null)   // 'transfer' | 'rate' | 'spatial_stats' | null
    const previousTheme = ref<string | null>(null)  // 记录上一次活跃的专题

    // 新增：专题上下文（参数与统计摘要），用于左右面板“专题监测”适配
    // 说明：这里不保存几何数据，仅保存 UI 展示所需的轻量信息（params/stats/breaks 等）。
    const themeContext = ref<Record<string, any>>({
        transfer: null,
        rate: null,
        spatial_stats: null
    })


    // 新增：当前切片拼音列表 (用于 CLCD 图层动态拼装)
    const currentPinyins = ref<string[]>([])


    // Actions
    function setYear(y: number) {
        currentYear.value = y
    }

    function setRange(r: number[]) {
        range.value = r
    }

    function setScope(level: string, code: string, name: string) {
        scope.value = { level, code, name }
    }

    function setActivePanel(panel: string | null) {
        activePanel.value = panel
    }

    function toggleMetric() {
        metricMode.value = metricMode.value === 'absolute' ? 'percent' : 'absolute'
    }

    function setYearsAll(arr: number[]) {
        yearsAll.value = arr
    }

    function updateLegend(data: any) {
        legendData.value = data
    }

    function clearLegend() {
        legendData.value = null
    }

    // 新增：图层状态控制
    function setActiveLayer(layer: string) {
        if (layer === 'land_transfer' && activeLayer.value !== 'land_transfer') {
            previousLayer.value = activeLayer.value
        }
        activeLayer.value = layer
    }

    function restorePreviousLayer() {
        if (activeLayer.value === 'land_transfer') {
            activeLayer.value = previousLayer.value
        }
    }

    // 新增：设置当前分析专题（自动记录上一专题以便清理）
    function setActiveTheme(theme: string | null) {
        previousTheme.value = activeTheme.value
        activeTheme.value = theme
    }

    function setThemeContext(theme: 'transfer' | 'rate' | 'spatial_stats', context: any) {
        themeContext.value[theme] = context
    }

    function clearThemeContext(theme: 'transfer' | 'rate' | 'spatial_stats' | 'all' = 'all') {
        if (theme === 'all') {
            themeContext.value = { transfer: null, rate: null, spatial_stats: null }
            return
        }
        themeContext.value[theme] = null
    }

    function setCurrentPinyins(pinyins: string[]) {
        currentPinyins.value = pinyins
    }


    return {
        scope,
        timeMode,
        currentYear,
        range,
        yearsAll,
        selectedClasses,
        metricMode,
        activePanel,
        legendData,
        activeLayer,
        previousLayer,
        activeTheme,
        previousTheme,
        themeContext,
        currentPinyins,
        setYear,
        setRange,
        setScope,
        setActivePanel,
        toggleMetric,
        setYearsAll,
        updateLegend,
        clearLegend,
        setActiveLayer,
        restorePreviousLayer,
        setActiveTheme,
        setThemeContext,
        clearThemeContext,
        setCurrentPinyins
    }
})
