<template>
  <div ref="el" class="chart"></div>
</template>

<script setup>
import * as echarts from 'echarts';
import { onMounted, onBeforeUnmount, ref, shallowRef, watch, computed, nextTick } from 'vue';
import { useGlobalStore } from '../../store/index.js';

const store = useGlobalStore();
const el = shallowRef(null);
const chart = shallowRef(null);

const palette = {
  'Cropland': '#F5D27A', 'Forest': '#3C7D4C', 'Shrub': '#66A65E', 'Grassland': '#B7D88A', 'Water': '#2E86DE', 'Snow/Ice': '#BFD6F6', 'Barren': '#C9B6A9', 'Impervious': '#D94E8F', 'Wetland': '#2FA9E0'
};

const currentData = ref([]); // {name, value}
const loading = ref(false);
const errorMsg = ref('');

function buildDemo() {
  currentData.value = [
    { name: 'Cropland', value: 110000 },
    { name: 'Forest', value: 150000 },
    { name: 'Grassland', value: 78000 },
    { name: 'Shrub', value: 23000 },
    { name: 'Water', value: 12500 },
    { name: 'Snow/Ice', value: 120 },
    { name: 'Barren', value: 15000 },
    { name: 'Impervious', value: 12000 },
    { name: 'Wetland', value: 9800 }
  ];
}

async function fetchYearSummary() {
  const level = store.scope.level; const code = store.scope.code;
  const y = store.currentYear;
  const url = `/api/clcd/${y}/summary` + (level === 'province' ? '' : `?level=${level}&code=${encodeURIComponent(code)}`);
  loading.value = true; errorMsg.value = '';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  let arr;
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) { throw new Error(`HTTP ${resp.status}`); }
    arr = await resp.json();
  } catch (e) {
    errorMsg.value = '使用示例数据（后端超时或不可用）';
    buildDemo();
    render();
    loading.value = false;
    return;
  } finally { clearTimeout(t); }
  currentData.value = arr.map(r => ({ name: r.class_name, value: r.area_km2 }));
  render();
  loading.value = false;
}

function render() {
  if (!chart.value && el.value) { chart.value = echarts.init(el.value); }
  const option = {
    tooltip: { trigger: 'item', formatter: p => `${p.name}<br/>${p.value.toLocaleString()} km² (${p.percent}%)` },
    legend: { type: 'scroll' },
    series: [{
      type: 'pie', roseType: 'area', radius: ['20%', '75%'],
      data: currentData.value.map(d => ({ ...d, itemStyle: { color: palette[d.name] } })),
      itemStyle: { borderColor: '#fff', borderWidth: 1 },
      emphasis: { scale: true, scaleSize: 6 }
    }]
  };
  chart.value.setOption(option);
}

watch(() => [store.currentYear, store.scope], fetchYearSummary, { deep: true });
onMounted(() => { nextTick(fetchYearSummary); window.addEventListener('resize', onResize); });
onBeforeUnmount(() => { window.removeEventListener('resize', onResize); if (chart.value) { chart.value.dispose(); chart.value = null; } });
function onResize() { chart.value && chart.value.resize(); }
</script>

<style scoped>
.chart {
  width: 100%;
  height: 340px;
}
</style>
