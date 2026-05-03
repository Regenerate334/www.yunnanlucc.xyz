<!--
  @component TransferRightPanel
  @description 土地流转专题监测 - 右侧面板（集中诊断 + 分级结构）
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
          <div class="stat-k">集中指数</div>
          <div class="stat-v">{{ fmtIdx(hhiIndex) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-k">基尼系数</div>
          <div class="stat-v">{{ fmtIdx(giniIndex) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-k">80%覆盖</div>
          <div class="stat-v">{{ cover80Count }}<span class="inline-u">单元</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-k">高值占比</div>
          <div class="stat-v">{{ fmtPct(highValueShare) }}<span class="inline-u">%</span></div>
        </div>
      </div>

      <div class="divider-line"></div>

      <div class="subheader">
        <span class="sub-title">累计贡献曲线</span>
        <span class="sub-hint">Top8单元</span>
      </div>
      <div class="chart-wrap conc-wrap">
        <div ref="lorenzRef" class="chart-box"></div>
        <div v-if="!rows.length" class="empty-hint empty-overlay">暂无流转数据。</div>
      </div>

      <div class="insight-box">
        <div class="insight-head">
          <div class="insight-title">文本诊断</div>
          <div class="insight-sub">{{ directionText }}</div>
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
import { TRANSFER_CLASS_NAMES } from '../../constants/landuse.js';

const globalStore = useGlobalStore();

defineProps({
  year: { type: Number, default: 2023 }
});
defineEmits(['update:year']);

const lorenzRef = shallowRef(null);
const lorenzChart = shallowRef(null);
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

const ctx = computed(() => globalStore.themeContext?.transfer || null);
const params = computed(() => ctx.value?.params || {});
const topUnits = computed(() => Array.isArray(ctx.value?.top_units) ? ctx.value.top_units : []);
const breaks = computed(() => Array.isArray(ctx.value?.breaks) ? ctx.value.breaks : []);

const rows = computed(() => {
  return topUnits.value
    .slice(0, 8)
    .map((u, idx) => ({
      name: String(u?.name || `区域${idx + 1}`),
      value: Number(u?.value) || 0
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
});

const fromName = computed(() => {
  const v = Number(params.value?.fromClass);
  if (!Number.isFinite(v)) return '全部地类';
  return TRANSFER_CLASS_NAMES[v] || `地类${v}`;
});

const toName = computed(() => {
  const v = Number(params.value?.toClass);
  if (!Number.isFinite(v)) return '全部地类';
  return TRANSFER_CLASS_NAMES[v] || `地类${v}`;
});

const directionText = computed(() => {
  const from = Number(params.value?.fromClass);
  const to = Number(params.value?.toClass);
  const hasFrom = Number.isFinite(from);
  const hasTo = Number.isFinite(to);
  if (hasFrom && !hasTo) return `${fromName.value}净流出`;
  if (!hasFrom && hasTo) return `${toName.value}净流入`;
  if (!hasFrom && !hasTo) return '总流转';
  return `${fromName.value}→${toName.value}`;
});

const headerText = computed(() => {
  const name = globalStore.scope?.name || '';
  const y1 = Number(params.value?.yearStart);
  const y2 = Number(params.value?.yearEnd);
  const period = Number.isFinite(y1) && Number.isFinite(y2) ? `${y1}-${y2}` : '';
  return `${name}${period ? ` ${period}` : ''} 土地流转监测`;
});

const topTotal = computed(() => rows.value.reduce((s, r) => s + r.value, 0));

const highThreshold = computed(() => {
  if (breaks.value.length >= 2) {
    const sorted = breaks.value
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v))
      .sort((a, b) => a - b);
    if (sorted.length >= 2) return sorted[sorted.length - 2];
  }
  const vals = rows.value.map((r) => r.value);
  if (!vals.length) return 0;
  return Math.max(...vals) * 0.65;
});

const highValueShare = computed(() => {
  if (!topTotal.value) return 0;
  const t = highThreshold.value;
  const high = rows.value.filter((r) => r.value >= t).reduce((s, r) => s + r.value, 0);
  return high / topTotal.value;
});

const cover80Count = computed(() => {
  const vals = rows.value.map((r) => r.value);
  const total = vals.reduce((s, v) => s + v, 0);
  if (!total) return 0;

  let cum = 0;
  for (let i = 0; i < vals.length; i += 1) {
    cum += vals[i];
    if (cum / total >= 0.8) return i + 1;
  }
  return vals.length;
});

const hhiIndex = computed(() => {
  const vals = rows.value.map((r) => r.value);
  const total = vals.reduce((s, v) => s + v, 0);
  if (!total) return 0;
  return vals.reduce((s, v) => {
    const p = v / total;
    return s + (p * p);
  }, 0);
});

const giniIndex = computed(() => {
  const vals = rows.value.map((r) => r.value).filter((v) => v > 0).sort((a, b) => a - b);
  const n = vals.length;
  if (n <= 1) return 0;

  const total = vals.reduce((s, v) => s + v, 0);
  if (!total) return 0;

  let weighted = 0;
  for (let i = 0; i < n; i += 1) {
    weighted += (i + 1) * vals[i];
  }

  const g = (2 * weighted) / (n * total) - ((n + 1) / n);
  return Math.min(Math.max(g, 0), 1);
});

const diagnosisBlocks = computed(() => {
  if (!rows.value.length) {
    return [
      {
        title: '数据状态',
        text: '当前范围内无可统计的土地流转单元，请调整时段、方向或行政范围后重试。',
        level: 'neutral'
      }
    ];
  }

  const g = giniIndex.value;
  const h = hhiIndex.value;
  const k = cover80Count.value;
  const totalUnits = rows.value.length;
  const firstShare = topTotal.value > 0 ? (rows.value[0]?.value || 0) / topTotal.value : 0;
  const secondShare = topTotal.value > 0 ? (rows.value[1]?.value || 0) / topTotal.value : 0;
  const top2Share = Math.min(firstShare + secondShare, 1);
  const maxRow = rows.value[0] || null;
  const minRow = rows.value[rows.value.length - 1] || null;
  const spread = maxRow && minRow && minRow.value > 0 ? maxRow.value / minRow.value : 0;
  const periodText = (() => {
    const y1 = Number(params.value?.yearStart);
    const y2 = Number(params.value?.yearEnd);
    if (Number.isFinite(y1) && Number.isFinite(y2)) return `${y1}-${y2}年`;
    return '当前时段';
  })();

  let concentrationText = '';
  let concentrationLevel = 'neutral';
  if (g >= 0.52 || h >= 0.32 || firstShare >= 0.45) {
    concentrationText = `在${periodText}${directionText.value}流转中，空间集中度偏高（基尼${fmtIdx(g)}，集中指数${fmtIdx(h)}），主导单元承载明显。`;
    concentrationLevel = 'warn';
  } else if (g <= 0.28 && h <= 0.16 && firstShare <= 0.24) {
    concentrationText = `在${periodText}${directionText.value}流转中，空间分布较均衡（基尼${fmtIdx(g)}，集中指数${fmtIdx(h)}），热点扩散特征更明显。`;
    concentrationLevel = 'good';
  } else {
    concentrationText = `在${periodText}${directionText.value}流转中，集中度处于中等区间（基尼${fmtIdx(g)}，集中指数${fmtIdx(h)}），存在核心单元但尚未极化。`;
    concentrationLevel = 'neutral';
  }

  let coverageText = '';
  let coverageLevel = 'neutral';
  if (k <= 3) {
    coverageText = `达到80%累计贡献仅需前${k}个单元，流转强度高度集中，建议优先核查核心承载区。`;
    coverageLevel = 'warn';
  } else if (k >= 6) {
    coverageText = `达到80%累计贡献需要前${k}个单元，说明流转扩散范围较广，需关注面状扩展风险。`;
    coverageLevel = 'good';
  } else {
    coverageText = `达到80%累计贡献需要前${k}个单元，集中与扩散并存。`;
    coverageLevel = 'neutral';
  }

  let headText = '';
  let headLevel = 'neutral';
  if (top2Share >= 0.65) {
    headText = `前2单元贡献已达${fmtPct(top2Share)}%，头部效应显著，建议跟踪其政策、地形与产业驱动差异。`;
    headLevel = 'warn';
  } else if (top2Share <= 0.35) {
    headText = `前2单元贡献为${fmtPct(top2Share)}%，头部虹吸效应较弱。`;
    headLevel = 'good';
  } else {
    headText = `前2单元贡献为${fmtPct(top2Share)}%，头部效应处于可控区间。`;
    headLevel = 'neutral';
  }

  let spreadText = '';
  let spreadLevel = 'neutral';
  if (spread >= 8) {
    spreadText = `Top${totalUnits}单元最大/最小值比为${fmtIdx(spread)}，层级差异较大，建议按层级制定差异化阈值。`;
    spreadLevel = 'warn';
  } else if (spread > 0) {
    spreadText = `Top${totalUnits}单元最大/最小值比为${fmtIdx(spread)}，层级差异相对平稳。`;
    spreadLevel = 'good';
  }

  let riskText = '';
  let riskLevel = 'neutral';
  if (highValueShare.value >= 0.58) {
    riskText = `高值占比达${fmtPct(highValueShare.value)}%，建议重点识别高强度持续转移带并建立持续监测清单。`;
    riskLevel = 'warn';
  } else if (highValueShare.value <= 0.25) {
    riskText = `高值占比为${fmtPct(highValueShare.value)}%，整体风险可控，但仍需监测新增热点。`;
    riskLevel = 'good';
  } else {
    riskText = `高值占比为${fmtPct(highValueShare.value)}%，建议持续跟踪高值单元扩张趋势。`;
    riskLevel = 'neutral';
  }

  const blocks = [
    { title: '空间集中性', text: concentrationText, level: concentrationLevel },
    { title: '贡献效率', text: coverageText, level: coverageLevel },
    { title: '头部结构', text: headText, level: headLevel },
    { title: '层级差异', text: spreadText, level: spreadLevel },
    { title: '风险提示', text: riskText, level: riskLevel }
  ];

  return blocks.filter((b) => b.text);
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

function fmtKm2(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  if (n === 0) return '0';
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  if (Math.abs(n) >= 100) return n.toFixed(1);
  if (Math.abs(n) >= 10) return n.toFixed(2);
  return n.toFixed(3);
}

function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.00';
  const p = n * 100;
  if (Math.abs(p) >= 10) return p.toFixed(2);
  if (Math.abs(p) >= 1) return p.toFixed(3);
  return p.toFixed(4);
}

function fmtIdx(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.000';
  return n.toFixed(3);
}

function initCharts() {
  if (lorenzRef.value) {
    if (lorenzChart.value) lorenzChart.value.dispose();
    lorenzChart.value = echarts.init(lorenzRef.value, null, { renderer: 'canvas' });
  }

}

function updateLorenzChart() {
  if (!lorenzChart.value) return;
  if (!rows.value.length || topTotal.value <= 0) {
    lorenzChart.value.clear();
    return;
  }

  const asc = rows.value.map((r) => r.value).sort((a, b) => a - b);
  const n = asc.length;
  const points = [[0, 0]];

  let cum = 0;
  for (let i = 0; i < n; i += 1) {
    cum += asc[i];
    points.push([
      Number((((i + 1) / n) * 100).toFixed(2)),
      Number(((cum / topTotal.value) * 100).toFixed(2))
    ]);
  }

  lorenzChart.value.setOption({
    backgroundColor: 'transparent',
    animationDuration: 700,
    animationEasing: 'cubicOut',
    grid: {
      top: 28,
      left: 45,
      right: 14,
      bottom: 30
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(4, 21, 51, 0.92)',
      borderColor: 'rgba(96, 165, 250, 0.45)',
      textStyle: { color: '#fff' },
      formatter: (items) => {
        const actual = items?.find((it) => it.seriesName === '累计贡献');
        if (!actual) return '';
        return `单元累计：${actual.value[0].toFixed(2)}%<br/>面积累计：${actual.value[1].toFixed(2)}%`;
      }
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: {
        color: 'rgba(255,255,255,0.72)',
        fontSize: 10,
        formatter: (v) => `${v}%`
      },
      splitLine: {
        lineStyle: { color: 'rgba(59,130,246,0.12)', type: 'dashed' }
      },
      axisLine: {
        lineStyle: { color: 'rgba(255,255,255,0.24)' }
      }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: {
        color: 'rgba(255,255,255,0.72)',
        fontSize: 10,
        formatter: (v) => `${v}%`
      },
      splitLine: {
        lineStyle: { color: 'rgba(59,130,246,0.12)', type: 'dashed' }
      },
      axisLine: {
        lineStyle: { color: 'rgba(255,255,255,0.24)' }
      }
    },
    series: [
      {
        name: '均衡线',
        type: 'line',
        showSymbol: false,
        data: [[0, 0], [100, 100]],
        lineStyle: {
          type: 'dashed',
          color: 'rgba(255,255,255,0.55)',
          width: 1.5
        }
      },
      {
        name: '累计贡献',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        data: points,
        lineStyle: {
          color: 'rgba(96,165,250,0.95)',
          width: 2.5
        },
        itemStyle: {
          color: 'rgba(219,234,254,0.95)'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59,130,246,0.26)' },
            { offset: 1, color: 'rgba(59,130,246,0.04)' }
          ])
        },
        markLine: {
          symbol: 'none',
          silent: true,
          lineStyle: {
            color: 'rgba(147,197,253,0.72)',
            type: 'dotted'
          },
          data: [{ xAxis: 80 }],
          label: {
            formatter: '80%阈值',
            color: 'rgba(219,234,254,0.86)',
            fontSize: 10
          }
        }
      }
    ]
  }, { notMerge: true });
}

function handleResize() {
  lorenzChart.value?.resize();
}

onMounted(async () => {
  await nextTick();
  initCharts();
  updateLorenzChart();
  await setupDiagnosisAutoScroll();

  setTimeout(() => {
    handleResize();
    updateLorenzChart();
    setupDiagnosisAutoScroll();
  }, 320);

  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  stopDiagnosisAutoScroll();

  if (lorenzChart.value) {
    lorenzChart.value.dispose();
    lorenzChart.value = null;
  }
});

watch(
  () => [rows.value, breaks.value, params.value?.fromClass, params.value?.toClass],
  async () => {
    await nextTick();
    if (!lorenzChart.value) initCharts();
    updateLorenzChart();
    await setupDiagnosisAutoScroll();
    setTimeout(() => {
      handleResize();
      updateLorenzChart();
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
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.1);
  padding: 8px 8px 10px;
  box-sizing: border-box;
  overflow: hidden;
}
.conc-wrap {
  height: 260px;
}
.chart-box {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.insight-box {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(18, 41, 90, 0.28) 0%, rgba(10, 23, 56, 0.2) 100%);
  padding: 10px 12px;
  flex: 1;
  min-height: 0;
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

