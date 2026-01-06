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

    function toggleMetric() {
        metricMode.value = metricMode.value === 'absolute' ? 'percent' : 'absolute'
    }

    function setYearsAll(arr: number[]) {
        yearsAll.value = arr
    }

    return {
        scope,
        timeMode,
        currentYear,
        range,
        yearsAll,
        selectedClasses,
        metricMode,
        setYear,
        setRange,
        setScope,
        toggleMetric,
        setYearsAll
    }
})
