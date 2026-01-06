<template>
  <div class="toolbar">
    <label><input type="checkbox" v-model="usePercent" /> 百分比</label>
  </div>
  <div ref="el" class="chart"></div>
</template>

<script setup>
import * as echarts from 'echarts';
import { onMounted, onBeforeUnmount, ref, shallowRef, watch, computed, nextTick } from 'vue';
import { useGlobalStore } from '../../stores/index.ts';

const store = useGlobalStore();
const el = shallowRef(null);
const chart = shallowRef(null);
const usePercent = ref(false);

const palette = {
  'Cropland': '#F5D27A', 'Forest': '#3C7D4C', 'Shrub': '#66A65E', 'Grassland': '#B7D88A', 'Water': '#2E86DE', 'Snow/Ice': '#BFD6F6', 'Barren': '#C9B6A9', 'Impervious': '#D94E8F', 'Wetland': '#2FA9E0'
};

const years = ref([]);
const dataByYear = ref({}); // {year: {className: area}}
const loading = ref(false);
const errorMsg = ref('');

// 示例数据（用于后端慢/不可用时的UI预览）
function buildDemo() {
  const ys = [1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2023];
  const names = ['Cropland', 'Forest', 'Shrub', 'Grassland', 'Water', 'Snow/Ice', 'Barren', 'Impervious', 'Wetland'];
  const byY = {};
  ys.forEach((y, idx) => {
    byY[y] = {
      'Cropland': 120000 - idx * 300 + 2000 * Math.sin(idx / 2),
      'Forest': 150000 + idx * 200,
      'Shrub': 22000 + 80 * idx,
      'Grassland': 80000 - idx * 150,
      'Water': 12000 + 12 * idx,
      'Snow/Ice': Math.max(200 - idx * 5, 20),
      'Barren': 16000 - 60 * idx,
      'Impervious': 9000 + 300 * idx,
      'Wetland': 9000 + 20 * idx
    };
  });
  years.value = ys;
  dataByYear.value = byY;
}

async function fetchSeries() {
  const level = store.scope.level; const code = store.scope.code;
  const start = store.timeMode === 'range' ? store.range[0] : 1990;
  const end = store.timeMode === 'range' ? store.range[1] : 2023;
  const q = new URLSearchParams({ start: String(start), end: String(end) });
  if (level !== 'province') { q.set('level', level); q.set('code', code); }
  const url = `/api/clcd/series?${q.toString()}`;
  loading.value = true; errorMsg.value = '';
  // 超时控制（5s）
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  let arr;
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) { throw new Error(`HTTP ${resp.status}`); }
    arr = await resp.json();
  } catch (e) {
    // 回退到示例数据
    errorMsg.value = '使用示例数据（后端超时或不可用）';
    buildDemo();
    loading.value = false;
    render();
    return;
  } finally { clearTimeout(t); }
  const grouped = {};
  arr.forEach(r => { if (!grouped[r.year]) grouped[r.year] = {}; grouped[r.year][r.class_name] = r.area_km2; });
  years.value = Object.keys(grouped).map(n => +n).sort((a, b) => a - b);
  dataByYear.value = grouped;
  store.setYearsAll(years.value);
  render();
  loading.value = false;
}

function render() {
  if (!chart.value && el.value) { chart.value = echarts.init(el.value); }

  if (chart.value._animationTimer) {
    clearTimeout(chart.value._animationTimer);
  }

  chart.value.clear();

  let currentStep = 0;
  const totalSteps = years.value.length;
  const allYears = years.value;

  // 预计算最大值以固定 Y 轴
  let maxY = 0;
  if (usePercent.value) {
    maxY = 100;
  } else {
    allYears.forEach(y => {
      let yearTotal = 0;
      const classNames = ['Cropland', 'Forest', 'Shrub', 'Grassland', 'Water', 'Snow/Ice', 'Barren', 'Impervious', 'Wetland'];
      classNames.forEach(name => {
        yearTotal += (dataByYear.value[y]?.[name] || 0);
      });
      if (yearTotal > maxY) maxY = yearTotal;
    });
    maxY = Math.ceil(maxY * 1.1);
  }

  const renderStep = () => {
    currentStep++;
    const visibleYears = allYears.slice(0, currentStep);

    const classNames = ['Cropland', 'Forest', 'Shrub', 'Grassland', 'Water', 'Snow/Ice', 'Barren', 'Impervious', 'Wetland'];
    const series = classNames.map(name => ({
      name,
      type: 'line', stack: usePercent.value ? 'pct' : 'total', showSymbol: true, symbolSize: 4, areaStyle: { opacity: 0.25 },
      itemStyle: { color: palette[name] },
      data: visibleYears.map(y => {
        const v = (dataByYear.value[y]?.[name]) || 0;
        return v;
      }),
      animation: false
    }));

    let yAxis = {
      type: 'value',
      name: usePercent.value ? '%' : 'km²',
      min: 0,
      max: maxY
    };
    let option = {
      tooltip: { trigger: 'axis' },
      legend: { type: 'scroll' },
      xAxis: { type: 'category', data: allYears },
      yAxis,
      dataZoom: [{ type: 'inside' }, { type: 'slider' }],
      series
    };

    chart.value.setOption(option, false);

    if (currentStep < totalSteps) {
      chart.value._animationTimer = setTimeout(renderStep, 80);
    }
  };

  renderStep();
}

watch([() => store.scope], fetchSeries, { deep: true });
watch(usePercent, render);
onMounted(() => { nextTick(fetchSeries); window.addEventListener('resize', onResize); });
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  if (chart.value) {
    if (chart.value._animationTimer) clearTimeout(chart.value._animationTimer);
    chart.value.dispose();
    chart.value = null;
  }
});
function onResize() { chart.value && chart.value.resize(); }
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 6px;
}

.chart {
  width: 100%;
  height: 300px;
}

.empty {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}
</style>
