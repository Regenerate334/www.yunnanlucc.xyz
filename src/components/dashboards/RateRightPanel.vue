<!--
  @component RateRightPanel
  @description 垦殖率/转换率专题监测 - 右侧面板（分布特征 + 阈值分级）
  @props year (保留与 Workbench v-model:year 兼容，不作为专题口径)
  @dependencies useGlobalStore, ECharts
-->
<template>
  <div class="right-panel-container">
    <div class="corner-decor top-right"></div>
    <div class="corner-decor bottom-left"></div>

    <section class="warning-section">
      <div class="section-header">
        <div class="title-decor"></div>
        <span class="header-text">{{ headerText }}</span>
        <div class="header-line"></div>
      </div>

      <div class="grid-2">
        <div class="stat-card">
          <div class="stat-k">极差</div>
          <div class="stat-v">{{ fmtPct(rangeRate) }}<span class="inline-u">%</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-k">离散度</div>
          <div class="stat-v">{{ fmtPct(stdRate) }}<span class="inline-u">%</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-k">前3集中</div>
          <div class="stat-v">{{ fmtPct(top3Share) }}<span class="inline-u">%</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-k">结构均衡</div>
          <div class="stat-v">{{ fmtPct(equilibrium) }}<span class="inline-u">%</span></div>
        </div>
      </div>

      <div class="divider-line"></div>

      <div class="subheader">
        <span class="sub-title">频数分布直方图</span>
        <span class="sub-hint">{{ modeText }}</span>
      </div>

      <div class="chart-wrap">
        <div ref="chartRef" class="chart-box"></div>
        <div v-if="!histogramData.length" class="empty-hint empty-overlay">暂无分布数据。</div>
      </div>

      <div class="insight-box">
        <div class="insight-head">
          <div class="insight-title">诊断信息</div>
          <div class="insight-sub">{{ modeText }}</div>
        </div>
        <div
          ref="insightViewportRef"
          class="insight-viewport"
          @wheel.prevent="handleDiagnosisWheel"
          @mouseenter="pauseDiagnosisAutoScroll"
          @mouseleave="resumeDiagnosisAutoScroll"
        >
          <div ref="insightTrackRef" class="insight-list">
            <div
              v-for="(item, idx) in diagnosisBlocks"
              :key="`${item.title}-A-${idx}`"
              data-diagnosis-card
              class="insight-item"
              :class="`level-${item.level}`"
            >
              <div class="insight-item-title">{{ item.title }}</div>
              <div class="insight-item-text">{{ item.text }}</div>
            </div>
            <div
              v-if="diagnosisLoopEnabled"
              v-for="(item, idx) in diagnosisBlocks"
              :key="`${item.title}-B-${idx}`"
              data-diagnosis-card
              class="insight-item"
              :class="`level-${item.level}`"
            >
              <div class="insight-item-title">{{ item.title }}</div>
              <div class="insight-item-text">{{ item.text }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
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
const insightViewportRef = shallowRef(null);
const insightTrackRef = shallowRef(null);
const diagnosisLoopEnabled = ref(false);
const autoScrollPaused = ref(false);

const DIAGNOSIS_STEP_INTERVAL = 3000;
const DIAGNOSIS_SWITCH_DURATION = 320;
const DIAGNOSIS_WHEEL_LOCK_MS = 320;

let diagnosisStepTimerId = 0;
let diagnosisWrapTimerId = 0;
let diagnosisCurrentIndex = 0;
let diagnosisCardCount = 0;
let diagnosisWheelLockUntil = 0;

const ctx = computed(() => globalStore.themeContext?.rate || null);
const params = computed(() => ctx.value?.params || {});
const stats = computed(() => ctx.value?.stats || { min: 0, max: 0, avg: 0, count: 0 });
const topUnits = computed(() => Array.isArray(ctx.value?.top_units) ? ctx.value.top_units : []);
const histogramData = computed(() => Array.isArray(ctx.value?.histogram) ? ctx.value.histogram : []);

const modeText = computed(() => {
  const attr = params.value?.attribute;
  if (attr === 'reclamation') return '垦殖率';
  if (attr === 'conversion') return '转换率';
  return '率值';
});

const headerText = computed(() => {
  const name = globalStore.scope?.name || '';
  const attr = modeText.value;
  if (params.value?.attribute === 'conversion') {
    const y1 = params.value?.year_start;
    const y2 = params.value?.year_end;
    const period = (Number.isFinite(Number(y1)) && Number.isFinite(Number(y2))) ? `${y1}-${y2}` : '';
    return `${name}${period ? ` ${period}` : ''} ${attr}监测`;
  }
  const y = params.value?.year;
  const yearText = Number.isFinite(Number(y)) ? `${y}年` : '';
  return `${name}${yearText ? ` ${yearText}` : ''} ${attr}监测`;
});

const rows = computed(() => {
  return topUnits.value
    .slice(0, 8)
    .map((u, idx) => ({
      name: String(u?.name || `区域${idx + 1}`),
      value: Number(u?.value) || 0
    }));
});

const rangeRate = computed(() => {
  const max = Number(stats.value?.max || 0);
  const min = Number(stats.value?.min || 0);
  return Math.max(0, max - min);
});

const stdRate = computed(() => {
  return Number(stats.value?.std || 0);
});

const top3Share = computed(() => {
  const vals = rows.value.map((r) => r.value);
  const total = vals.reduce((s, v) => s + v, 0);
  if (!total) return 0;
  return vals.slice(0, 3).reduce((s, v) => s + v, 0) / total;
});

const equilibrium = computed(() => {
  const vals = rows.value.map((r) => r.value).filter((v) => v > 0);
  const n = vals.length;
  if (n <= 1) return 0;
  const total = vals.reduce((s, v) => s + v, 0);
  if (!total) return 0;
  let entropy = 0;
  vals.forEach((v) => {
    const p = v / total;
    entropy += -p * Math.log(p);
  });
  return entropy / Math.log(n);
});

const diagnosisBlocks = computed(() => {
  if (!rows.value.length) {
    return [
      {
        title: '数据状态',
        text: '当前参数下暂无可用区域分布数据，请调整空间单元、年份或指标后重试。',
        level: 'neutral'
      }
    ];
  }

  const vals = rows.value.map((r) => Number(r.value || 0)).filter((v) => Number.isFinite(v));
  const n = vals.length;
  const avg = Number(stats.value?.avg || 0);
  const max = Number(stats.value?.max || 0);
  const min = Number(stats.value?.min || 0);
  const top1 = vals[0] || 0;
  const top2 = vals[1] || 0;
  const total = vals.reduce((s, v) => s + v, 0);
  const top2Share = total > 0 ? (top1 + top2) / total : 0;
  const cv = avg > 0 ? stdRate.value / avg : 0;
  const spread = min > 0 ? max / min : 0;
  const periodText = (() => {
    if (params.value?.attribute === 'conversion') {
      const y1 = Number(params.value?.year_start);
      const y2 = Number(params.value?.year_end);
      if (Number.isFinite(y1) && Number.isFinite(y2)) return `${y1}-${y2}年`;
    } else {
      const y = Number(params.value?.year);
      if (Number.isFinite(y)) return `${y}年`;
    }
    return '当前时段';
  })();

  let distLevel = 'neutral';
  let distText = '';
  if (cv >= 0.5 || rangeRate.value >= Math.max(avg * 1.2, 0.1)) {
    distLevel = 'warn';
    distText = `${periodText}${modeText.value}空间离散度偏高（极差${fmtPct(rangeRate.value)}%，离散度${fmtPct(stdRate.value)}%），区域差异明显。`;
  } else if (cv <= 0.25) {
    distLevel = 'good';
    distText = `${periodText}${modeText.value}空间分布较平稳（极差${fmtPct(rangeRate.value)}%，离散度${fmtPct(stdRate.value)}%）。`;
  } else {
    distLevel = 'neutral';
    distText = `${periodText}${modeText.value}处于中等离散区间（极差${fmtPct(rangeRate.value)}%，离散度${fmtPct(stdRate.value)}%）。`;
  }

  let headLevel = 'neutral';
  let headText = '';
  if (top2Share >= 0.6) {
    headLevel = 'warn';
    headText = `前2单元贡献已达${fmtPct(top2Share)}%，头部集聚显著，建议优先核查核心区域变化驱动。`;
  } else if (top2Share <= 0.35) {
    headLevel = 'good';
    headText = `前2单元贡献为${fmtPct(top2Share)}%，头部效应偏弱，分布相对均衡。`;
  } else {
    headLevel = 'neutral';
    headText = `前2单元贡献为${fmtPct(top2Share)}%，头部效应处于可控区间。`;
  }

  let structureLevel = 'neutral';
  let structureText = '';
  if (equilibrium.value >= 0.8) {
    structureLevel = 'good';
    structureText = `结构均衡度为${fmtPct(equilibrium.value)}%，整体区域结构较均衡。`;
  } else if (equilibrium.value <= 0.5) {
    structureLevel = 'warn';
    structureText = `结构均衡度为${fmtPct(equilibrium.value)}%，区域结构差异较大，建议关注高值单元持续扩张。`;
  } else {
    structureLevel = 'neutral';
    structureText = `结构均衡度为${fmtPct(equilibrium.value)}%，结构稳定性中等。`;
  }

  let spreadText = '';
  let spreadLevel = 'neutral';
  if (spread >= 6) {
    spreadLevel = 'warn';
    spreadText = `Top${n}单元最大/最小值比为${fmtPct(spread)}%，层级差异明显，建议采用分层阈值管理。`;
  } else if (spread > 0) {
    spreadLevel = 'good';
    spreadText = `Top${n}单元最大/最小值比为${fmtPct(spread)}%，层级差异相对平稳。`;
  }

  return [
    { title: '分布特征', text: distText, level: distLevel },
    { title: '头部结构', text: headText, level: headLevel },
    { title: '结构稳定性', text: structureText, level: structureLevel },
    { title: '层级差异', text: spreadText, level: spreadLevel }
  ].filter((b) => b.text);
});

function clearDiagnosisTimers() {
  if (diagnosisStepTimerId) {
    window.clearTimeout(diagnosisStepTimerId);
    diagnosisStepTimerId = 0;
  }
  if (diagnosisWrapTimerId) {
    window.clearTimeout(diagnosisWrapTimerId);
    diagnosisWrapTimerId = 0;
  }
}

function stopDiagnosisAutoScroll() {
  clearDiagnosisTimers();
  diagnosisCurrentIndex = 0;
  diagnosisCardCount = 0;
  diagnosisWheelLockUntil = 0;
}

function getDiagnosisCards() {
  const track = insightTrackRef.value;
  if (!track) return [];
  return Array.from(track.querySelectorAll('[data-diagnosis-card]'));
}

function scrollToDiagnosisCard(index, smooth = true) {
  const viewport = insightViewportRef.value;
  const cards = getDiagnosisCards();
  const target = cards[index];
  if (!viewport || !target) return false;
  viewport.scrollTo({
    top: target.offsetTop,
    behavior: smooth ? 'smooth' : 'auto'
  });
  return true;
}

function scheduleDiagnosisStep() {
  if (autoScrollPaused.value || diagnosisCardCount <= 1) return;
  if (diagnosisStepTimerId) {
    window.clearTimeout(diagnosisStepTimerId);
    diagnosisStepTimerId = 0;
  }
  diagnosisStepTimerId = window.setTimeout(() => {
    diagnosisStepTimerId = 0;
    runDiagnosisStep();
  }, DIAGNOSIS_STEP_INTERVAL);
}

function runDiagnosisStep() {
  if (autoScrollPaused.value || diagnosisCardCount <= 1) return;

  const nextIndex = diagnosisCurrentIndex + 1;
  const ok = scrollToDiagnosisCard(nextIndex, true);
  if (!ok) {
    diagnosisCurrentIndex = 0;
    scrollToDiagnosisCard(0, false);
    scheduleDiagnosisStep();
    return;
  }

  diagnosisCurrentIndex = nextIndex;

  // 进入复制列表的首卡后，快速无动画回跳到原列表首卡，实现无缝轮播。
  if (diagnosisLoopEnabled.value && diagnosisCurrentIndex >= diagnosisCardCount) {
    if (diagnosisWrapTimerId) {
      window.clearTimeout(diagnosisWrapTimerId);
      diagnosisWrapTimerId = 0;
    }
    diagnosisWrapTimerId = window.setTimeout(() => {
      diagnosisWrapTimerId = 0;
      if (autoScrollPaused.value) return;
      diagnosisCurrentIndex = 0;
      scrollToDiagnosisCard(0, false);
    }, DIAGNOSIS_SWITCH_DURATION + 40);
  }

  scheduleDiagnosisStep();
}

async function setupDiagnosisAutoScroll() {
  stopDiagnosisAutoScroll();
  autoScrollPaused.value = false;
  diagnosisLoopEnabled.value = false;

  await nextTick();
  const viewport = insightViewportRef.value;
  const track = insightTrackRef.value;
  if (!viewport || !track) return;

  viewport.scrollTop = 0;
  diagnosisCardCount = diagnosisBlocks.value.length;
  if (diagnosisCardCount <= 1) return;
  const originalHeight = track.scrollHeight;
  const hasOverflow = originalHeight > viewport.clientHeight + 4;
  if (!hasOverflow) return;

  diagnosisLoopEnabled.value = true;
  await nextTick();
  diagnosisCurrentIndex = 0;
  viewport.scrollTop = 0;
  scrollToDiagnosisCard(0, false);
  scheduleDiagnosisStep();
}

function pauseDiagnosisAutoScroll() {
  clearDiagnosisTimers();
  autoScrollPaused.value = true;
}

function resumeDiagnosisAutoScroll() {
  if (!autoScrollPaused.value) return;
  autoScrollPaused.value = false;
  if (diagnosisCardCount <= 1) return;
  if (diagnosisCurrentIndex >= diagnosisCardCount) {
    diagnosisCurrentIndex = diagnosisCurrentIndex % diagnosisCardCount;
    scrollToDiagnosisCard(diagnosisCurrentIndex, false);
  }
  scheduleDiagnosisStep();
}

function handleDiagnosisWheel(event) {
  if (diagnosisCardCount <= 1) return;

  const now = Date.now();
  if (now < diagnosisWheelLockUntil) return;
  diagnosisWheelLockUntil = now + DIAGNOSIS_WHEEL_LOCK_MS;

  const direction = event.deltaY > 0 ? 1 : event.deltaY < 0 ? -1 : 0;
  if (!direction) return;

  clearDiagnosisTimers();
  if (diagnosisCurrentIndex >= diagnosisCardCount) {
    diagnosisCurrentIndex = diagnosisCurrentIndex % diagnosisCardCount;
  }

  const nextIndex = Math.min(
    diagnosisCardCount - 1,
    Math.max(0, diagnosisCurrentIndex + direction)
  );
  if (nextIndex === diagnosisCurrentIndex) {
    scheduleDiagnosisStep();
    return;
  }

  diagnosisCurrentIndex = nextIndex;
  scrollToDiagnosisCard(diagnosisCurrentIndex, true);
  scheduleDiagnosisStep();
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
  if (!histogramData.value.length) {
    chartInstance.value.clear();
    return;
  }

  const counts = histogramData.value.map((item) => item.count);
  const maxCount = Math.max(...counts, 0);
  const maxAxis = maxCount > 0 ? Math.ceil(maxCount * 1.15) : 5;

  chartInstance.value.setOption({
    backgroundColor: 'transparent',
    animationDuration: 700,
    animationEasing: 'cubicOut',
    grid: {
      top: 25,
      left: 8,
      right: 12,
      bottom: 8,
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(4, 21, 51, 0.9)',
      borderColor: 'rgba(96, 165, 250, 0.45)',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const idx = Number(params?.[0]?.dataIndex ?? 0);
        const item = histogramData.value[idx];
        if (!item) return '';
        const minPct = (item.min * 100).toFixed(2);
        const maxPct = (item.max * 100).toFixed(2);
        return `区间: ${minPct}% - ${maxPct}%<br/>县市数量: <b>${item.count}</b> 个`;
      }
    },
    xAxis: {
      type: 'category',
      data: histogramData.value.map((item) => {
        const minPct = (item.min * 100).toFixed(1);
        const maxPct = (item.max * 100).toFixed(1);
        return `${minPct}-${maxPct}%`;
      }),
      axisTick: { show: false },
      axisLine: {
        lineStyle: { color: 'rgba(255, 255, 255, 0.22)' }
      },
      axisLabel: {
        color: 'rgba(255,255,255,0.82)',
        fontSize: 9,
        interval: 0,
        rotate: 15
      }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: maxAxis,
      minInterval: 1,
      splitLine: {
        lineStyle: { color: 'rgba(59,130,246,0.12)', type: 'dashed' }
      },
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        color: 'rgba(255,255,255,0.66)',
        fontSize: 10,
        formatter: (v) => `${v}个`
      }
    },
    series: [
      {
        name: '分布数量',
        type: 'bar',
        barWidth: '60%',
        data: counts,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 245, 255, 0.85)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.25)' }
          ]),
          borderRadius: [3, 3, 0, 0],
          borderColor: 'rgba(0, 245, 255, 0.4)',
          borderWidth: 1
        },
        emphasis: {
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0, 245, 255, 1)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.45)' }
            ])
          }
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
  await setupDiagnosisAutoScroll();
  setTimeout(() => {
    handleResize();
    updateChart();
    setupDiagnosisAutoScroll();
  }, 320);
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  stopDiagnosisAutoScroll();
  if (chartInstance.value) {
    chartInstance.value.dispose();
    chartInstance.value = null;
  }
});

watch(
  () => [histogramData.value, modeText.value, stats.value?.avg, stats.value?.max, stats.value?.min],
  async () => {
    await nextTick();
    if (!chartInstance.value && chartRef.value) initChart();
    updateChart();
    await setupDiagnosisAutoScroll();
    setTimeout(() => {
      handleResize();
      updateChart();
      setupDiagnosisAutoScroll();
    }, 120);
  },
  { deep: true }
);
</script>

<style scoped>
.right-panel-container {
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

.right-panel-container::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px));
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
.top-right { top: 0; right: 22px; }
.bottom-left { bottom: 22px; left: 0; }

.warning-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
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

.divider-line {
  height: 1px;
  width: 100%;
  background: linear-gradient(90deg, rgba(0, 245, 255, 0.35) 0%, transparent 75%);
  margin: 2px 0;
}

.subheader {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.sub-title {
  font-size: 16px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 0.5px;
}
.sub-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.chart-wrap {
  position: relative;
  height: 270px;
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

.insight-box {
  flex: 1;
  min-height: 0;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(18, 41, 90, 0.28) 0%, rgba(10, 23, 56, 0.2) 100%);
  padding: 10px 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.insight-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.insight-title {
  font-size: 15px;
  font-weight: 700;
  color: rgba(245, 249, 255, 0.96);
  letter-spacing: 0.5px;
}
.insight-sub {
  font-size: 12px;
  color: rgba(191, 219, 254, 0.9);
  background: rgba(59, 130, 246, 0.16);
  border: 1px solid rgba(96, 165, 250, 0.32);
  border-radius: 10px;
  padding: 2px 8px;
}
.insight-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
  padding-bottom: 0;
}
.insight-viewport {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 0;
  scroll-snap-type: y mandatory;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.insight-viewport::-webkit-scrollbar {
  display: none;
}
.insight-item {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  box-sizing: border-box;
  flex: 0 0 100%;
  min-height: 100%;
  height: 100%;
  scroll-snap-align: start;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(191, 219, 254, 0.14);
}
.insight-item-title {
  font-size: 12px;
  font-weight: 700;
  color: rgba(191, 219, 254, 0.92);
  margin-bottom: 3px;
  letter-spacing: 0.3px;
}
.insight-item-text {
  font-size: 14px;
  color: rgba(246, 250, 255, 0.95);
  line-height: 1.55;
}
.insight-item.level-warn {
  border-left: 3px solid rgba(96, 165, 250, 0.95);
}
.insight-item.level-good {
  border-left: 3px solid rgba(147, 197, 253, 0.86);
}
.insight-item.level-neutral {
  border-left: 3px solid rgba(191, 219, 254, 0.72);
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
