import { createPinia, defineStore } from 'pinia';

export const pinia = createPinia();

// 全局状态：时间、维度、类别选择与显示模式
export const useGlobalStore = defineStore('global', {
  state: () => ({
    scope: { level: 'province', code: 'yunnan' },
    timeMode: 'single', // 'single' | 'range'
    currentYear: 1985,
    range: [1985, 2023],
    yearsAll: [1985, ...Array.from({ length: 2023 - 1990 + 1 }, (_, i) => 1990 + i)],
    selectedClasses: ['Cropland','Forest','Shrub','Grassland','Water','Snow/Ice','Barren','Impervious','Wetland'],
    metricMode: 'absolute', // 'absolute' | 'percent'
  }),
  actions: {
    setYear(y) { this.currentYear = y; },
    setRange(r) { this.range = r; },
    setScope(level, code) { this.scope = { level, code }; },
    toggleMetric() { this.metricMode = this.metricMode === 'absolute' ? 'percent' : 'absolute'; },
    setYearsAll(arr) { this.yearsAll = arr; }
  }
});


