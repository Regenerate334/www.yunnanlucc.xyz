import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useGlobalStore = defineStore('global', () => {
    // State
    const scope = ref({ level: 'province', code: 'yunnan' })
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


    // Actions
    function setYear(y: number) {
        currentYear.value = y
    }

    function setRange(r: number[]) {
        range.value = r
    }

    function setScope(level: string, code: string) {
        scope.value = { level, code }
    }

    function setActivePanel(panel: string | null) {
        activePanel.value = activePanel.value === panel ? null : panel
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
        setActiveTheme
    }
})
