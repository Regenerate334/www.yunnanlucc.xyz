<!--
  @component RateLeftPanel
  @description 垦殖率/转换率专题监测 - 左侧面板（统计特征 + 热点柱状图）
  @props year (保留与 Workbench v-model:year 兼容，不作为专题口径)
  @dependencies useGlobalStore, ECharts
-->
<template>
  <div class="tech-panel-container">
    <div class="corner-decor top-left"></div>
    <div class="corner-decor bottom-right"></div>

    <section class="analysis-section">
      <div class="panel-content">
        <div class="section-header">
          <div class="title-decor"></div>
          <span class="header-text">{{ headerText }}</span>
          <div class="header-line"></div>
        </div>

        <div class="grid-2">
          <div class="stat-card">
            <div class="stat-k">均值</div>
            <div class="stat-v">{{ fmtPct(stats.avg) }}<span class="inline-u">%</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-k">最大</div>
            <div class="stat-v">{{ fmtPct(stats.max) }}<span class="inline-u">%</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-k">最小</div>
            <div class="stat-v">{{ fmtPct(stats.min) }}<span class="inline-u">%</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-k">样本</div>
            <div class="stat-v">{{ stats.count }}<span class="inline-u">{{ sampleUnit }}</span></div>
          </div>
        </div>

        <div class="divider-line"></div>

        <div class="subheader">
          <div class="subheader-left">
            <span class="subheader-title">热点柱状图</span>
            <span class="subheader-hint">{{ subHint }}</span>
          </div>
        </div>

        <div class="chart-wrap">
          <div ref="chartRef" class="chart-box"></div>
          <div v-if="!topUnits.length" class="empty-hint empty-overlay">暂无图表数据。</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, shallowRef, watch } from 'vue';
import * as echarts from 'echarts';
import { useGlobalStore } from '../../stores/global';
import { PREFECTURE_SHORT_NAMES } from '../../constants/landuse.js';

const globalStore = useGlobalStore();

defineProps({
  year: { type: Number, default: 2023 }
});
defineEmits(['update:year']);

const chartRef = shallowRef(null);
const chartInstance = shallowRef(null);

const ctx = computed(() => globalStore.themeContext?.rate || null);
const params = computed(() => ctx.value?.params || {});
const stats = computed(() => ctx.value?.stats || { min: 0, max: 0, avg: 0, count: 0 });
const topUnits = computed(() => Array.isArray(ctx.value?.top_units) ? ctx.value.top_units : []);

const modeText = computed(() => {
  const attr = params.value?.attribute;
  if (attr === 'reclamation') return '垦殖率';
  if (attr === 'conversion') return '转换率';
  return '率值';
});

const headerText = computed(() => `${globalStore.scope?.name || ''}${modeText.value}监测`);

const sampleUnit = computed(() => {
  const u = params.value?.unit;
  if (u === 'grid') return '格网';
  return '县';
});

const subHint = computed(() => {
  if (params.value?.attribute !== 'conversion') return '前8单元';
  const y1 = Number(params.value?.year_start);
  const y2 = Number(params.value?.year_end);
  if (Number.isFinite(y1) && Number.isFinite(y2)) return `${y1}-${y2}`;
  return '前8单元';
});

function getRows() {
  return topUnits.value
    .slice(0, 8)
    .map((u, idx) => ({
      name: String(u?.name || `区域${idx + 1}`),
      value: Number(u?.value) || 0
    }));
}

function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.00';
  const p = n * 100;
  if (Math.abs(p) >= 10) return p.toFixed(2);
  if (Math.abs(p) >= 1) return p.toFixed(3);
  return p.toFixed(4);
}

function shortName(name) {
  const raw = String(name || '');
  if (!raw) return '';

  if (PREFECTURE_SHORT_NAMES[raw]) {
    return `${PREFECTURE_SHORT_NAMES[raw]}州`;
  }

  const compact = raw
    .replace(/(哈尼族|彝族|壮族|苗族|傣族|景颇族|傈僳族|藏族|白族|纳西族|拉祜族|佤族|布朗族|普米族|阿昌族|怒族|基诺族|德昂族|独龙族|回族|蒙古族|土家族|满族|黎族|侗族|瑶族|羌族|布依族|朝鲜族)/g, '')
    .replace(/自治州$/g, '州')
    .replace(/自治县$/g, '县')
    .replace(/自治区$/g, '区');

  return compact.length > 7 ? `${compact.slice(0, 7)}…` : compact;
}

function initChart() {
  if (!chartRef.value) return;
  if (chartInstance.value) chartInstance.value.dispose();
  chartInstance.value = echarts.init(chartRef.value, null, { renderer: 'canvas' });
}

function updateChart() {
  if (!chartInstance.value) return;
  const rows = getRows();
  if (!rows.length) {
    chartInstance.value.clear();
    return;
  }
  const values = rows.map(r => r.value);
  const total = values.reduce((s, v) => s + v, 0);
  const max = Math.max(...values, 0);

  chartInstance.value.setOption({
    backgroundColor: 'transparent',
    animationDuration: 700,
    animationEasing: 'cubicOut',
    grid: {
      top: 8,
      left: 8,
      right: 12,
      bottom: 8,
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(4, 21, 51, 0.9)',
      borderColor: 'rgba(0, 245, 255, 0.45)',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const item = params?.[0];
        const idx = Number(item?.dataIndex ?? 0);
        const row = rows[idx];
        if (!row) return '';
        const share = total > 0 ? (row.value / total) * 100 : 0;
        return `${row.name}<br/>${modeText.value}：${fmtPct(row.value)}%<br/>贡献：${share.toFixed(2)}%`;
      }
    },
    xAxis: {
      type: 'value',
      max: max > 0 ? Number((max * 1.2).toFixed(6)) : 1,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: { color: 'rgba(0, 245, 255, 0.12)', type: 'dashed' }
      },
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.62)',
        fontSize: 11,
        formatter: (value) => `${fmtPct(value)}%`
      }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      axisTick: { show: false },
      axisLine: {
        lineStyle: { color: 'rgba(255, 255, 255, 0.16)' }
      },
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 12,
        formatter: (value) => shortName(value)
      },
      data: rows.map(r => r.name)
    },
    series: [
      {
        type: 'bar',
        data: rows.map(r => r.value),
        barWidth: 12,
        itemStyle: {
          borderRadius: [0, 8, 8, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.92)' },
            { offset: 1, color: 'rgba(37, 99, 235, 0.78)' }
          ]),
          shadowColor: 'rgba(59, 130, 246, 0.26)',
          shadowBlur: 10
        },
        label: {
          show: true,
          position: 'right',
          color: '#ffffff',
          fontSize: 11,
          formatter: (params) => `${fmtPct(params.value)}%`
        }
      }
    ]
  }, { notMerge: true });
}

function handleResize() {
  chartInstance.value?.resize();
}

onMounted(async () => {
  await nextTick();
  initChart();
  updateChart();
  setTimeout(() => {
    handleResize();
    updateChart();
  }, 320);
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (chartInstance.value) {
    chartInstance.value.dispose();
    chartInstance.value = null;
  }
});

watch(
  () => [topUnits.value, modeText.value],
  async () => {
    await nextTick();
    if (!chartInstance.value && chartRef.value) initChart();
    updateChart();
    setTimeout(() => {
      handleResize();
      updateChart();
    }, 120);
  },
  { deep: true }
);
</script>

<style scoped>
.tech-panel-container {
  width: 480px;
  height: 760px;
  position: relative;
  padding: 36px 30px 30px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  user-select: none;
  -webkit-user-select: none;
  overflow: hidden;
  max-width: 100%;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}

.tech-panel-container::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  clip-path: polygon(22px 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%, 0 22px);
  background: linear-gradient(135deg, rgba(10, 25, 70, 0.78) 0%, rgba(15, 35, 80, 0.62) 100%);
  backdrop-filter: blur(28px) saturate(190%);
  -webkit-backdrop-filter: blur(28px) saturate(190%);
  border: 1.5px solid rgba(0, 245, 255, 0.4);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 30px rgba(0, 245, 255, 0.12);
}

.corner-decor {
  position: absolute;
  width: 6px;
  height: 6px;
  background: #00f5ff;
  box-shadow: 0 0 8px #00f5ff;
  z-index: 10;
}
.top-left { top: 0; left: 22px; }
.bottom-right { bottom: 22px; right: 0; }

.analysis-section {
  height: 100%;
  min-height: 0;
}

.panel-content {
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  z-index: 5;
  min-height: 0;
}

.section-header {
  display: flex;
  align-items: center;
  position: relative;
  padding-bottom: 8px;
}
.title-decor {
  width: 4px;
  height: 18px;
  background: #f5a623;
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(245, 166, 35, 0.8), 0 0 20px rgba(245, 166, 35, 0.4);
  margin-right: 12px;
}
.header-text {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 2.5px;
  color: #ffffff;
  text-shadow: 0 0 12px rgba(245, 166, 35, 0.4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.header-line {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, rgba(245, 166, 35, 0.6) 0%, transparent 80%);
}

.divider-line {
  height: 1px;
  width: 100%;
  background: linear-gradient(90deg, rgba(0, 245, 255, 0.35) 0%, transparent 75%);
  margin: 2px 0;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.stat-card {
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.stat-k {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0;
}
.stat-v {
  margin-top: 2px;
  font-size: 28px;
  font-weight: 700;
  font-family: 'YouSheBiaoTiHei', 'Impact', 'Arial Black', sans-serif;
  font-style: italic;
  letter-spacing: 1px;
  background: linear-gradient(180deg, #ffffff 0%, #d1e8ff 40%, #7dbfff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0px 2px 6px rgba(125, 191, 255, 0.5));
  line-height: 1.1;
}
.inline-u {
  margin-left: 4px;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  text-shadow: 0 0 4px rgba(255, 255, 255, 0.1);
  white-space: nowrap;
  vertical-align: baseline;
  -webkit-text-fill-color: rgba(255, 255, 255, 0.5);
  background: none;
  filter: none;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  font-style: normal;
  letter-spacing: 0;
}

.subheader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 2px;
}
.subheader-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.subheader-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #ffffff;
}
.subheader-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.chart-wrap {
  position: relative;
  flex: 1;
  min-height: 240px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.1);
  padding: 8px 8px 10px;
  box-sizing: border-box;
  overflow: hidden;
}
.chart-box {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.empty-hint {
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.65);
  font-size: 13px;
}
.empty-overlay {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  white-space: nowrap;
}
</style>

