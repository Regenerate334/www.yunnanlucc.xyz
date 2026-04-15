<template>
  <div class="right-panel-container">
    <!-- 顶部切角装饰线 (模拟有棱有角的工业感边框) -->
    <div class="corner-decor top-right"></div>
    <div class="corner-decor bottom-left"></div>

    <section class="warning-section">
      <!-- 标题区 -->
      <div class="section-header">
        <div class="title-decor"></div>
        <span class="header-text">{{ globalStore.scope.name }}{{ props.year }}年风险监测</span>
        <div class="header-line"></div>
      </div>

      <!-- 综合预警仪表大核心 (改为左右布局) -->
      <div class="gauge-hero-box">
        <!-- 左侧：预警分级标准 -->
        <div class="hero-standard-col">
          <div class="standard-title">预警标准 (0-100)</div>
          <div class="threshold-list">
            <div v-for="(lv, key) in LEVELS" :key="key" class="threshold-item">
              <div class="color-bar" :style="{ backgroundColor: lv.color }"></div>
              <div class="level-info">
                <span class="level-range">{{ getRangeText(key) }}</span>
                <span class="level-tag" :style="{ color: lv.color }">{{ lv.text }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：动态仪表盘 -->
        <div class="hero-gauge-col">
          <div class="echarts-gauge-box">
            <div ref="gaugeChartRef" style="width: 100%; height: 100%;"></div>
          </div>
          
          <div class="gauge-status-badge">
            <div class="status-bg" :style="{ borderColor: statusColor }">
              <span class="status-dot" :style="{ backgroundColor: statusColor }"></span>
              {{ statusLevel }}
            </div>
          </div>
        </div>
      </div>

      <div class="composite-info">
        <div class="score-row">
          <span class="score-label">综合风险指数</span>
          <span class="score-val" :style="{ color: statusColor }">{{ compositeScore.toFixed(0) }}</span>
          <span class="score-max">/ 100</span>
        </div>
      </div>

      <!-- 指标分隔线 -->
      <div class="divider-line"></div>

      <!-- 指标详情卡片网格 -->
      <div class="indicators-grid">
        <div v-for="item in warningIndicators" :key="item.id" class="indicator-wrapper">
          <!-- 实际显示的卡片内容 (带切角背景) -->
          <div class="indicator-card" :style="{ '--card-accent': item.color }">
            <div class="card-clip-mark"></div>
            
            <div class="card-header-row">
              <span class="card-name" :title="item.title">{{ item.title }}</span>
              <div class="card-status-badge">
                <span class="badge-light" :style="{ backgroundColor: item.color }"></span>
                <span class="badge-text" :style="{ color: item.color }">{{ item.levelText }}</span>
              </div>
            </div>

            <div class="card-score-tag" :style="{ color: item.color, borderColor: `${item.color}40` }">
              风险分: {{ item.score.toFixed(1) }}
            </div>

            <div class="card-metric-row">
              <span class="metric-big-num">{{ item.valueText }}</span>
              <span class="metric-unit">{{ item.unit }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import { clcdApi } from '../../api/index.js';
import { useGlobalStore } from '../../stores/global';

const globalStore = useGlobalStore();

const props = defineProps({
  year: { type: Number, default: 2023 }
});

const loading = ref(true);
const trendData = ref([]);
const compositeScore = ref(0);

// 监听全局区域变化
watch(() => globalStore.scope, () => {
    fetchData();
}, { deep: true });

/* ======= 四级预警分级体系 ======= */
const LEVELS = {
  safe:    { text: '安全', color: '#00c864' },
  watch:   { text: '关注', color: '#f5a623' },
  warning: { text: '警告', color: '#ff8c00' },
  alert:   { text: '严重', color: '#ff4757' }
};

const warningIndicators = ref([
  { id: 'hq',   title: 'InVEST生境质量', level: 'safe', levelText: '优(GEP)', color: '#00c864', valueText: '0.00', score: 0, unit: 'Idx', desc: '正在计算中...', formula: 'Sharp(2020) InVEST: Σ(P_i × 适宜性度)×100' },
  { id: 'cmp',  title: '源汇碳代谢压力', level: 'safe', levelText: '低压(汇)', color: '#00c864', valueText: '0.00', score: 0, unit: '倍', desc: '正在计算中...', formula: '赵荣钦(2022) 双碳评估: Σ碳源 / Σ碳汇' },
  { id: 'eres', title: '全域生态韧性度', level: 'safe', levelText: '强韧', color: '#00c864', valueText: '0.00', score: 0, unit: 'Idx', desc: '正在计算中...', formula: 'Peng(2023) 韧性城市: 景观阻抗与恢复赋权' },
  { id: 'plec', title: '三生空间冲突度', level: 'safe', levelText: '低频', color: '#00c864', valueText: '0.00', score: 0, unit: '比', desc: '正在计算中...', formula: '刘彦随(2020) 国土规划: 生产生活区 / 生态区' }
]);

const gaugeChartRef = ref(null);
let gaugeChart = null;

const statusLevel = computed(() => {
  if (compositeScore.value < 25) return '全域安全';
  if (compositeScore.value < 50) return '关注风险';
  if (compositeScore.value < 75) return '预警响应';
  return '高级警报';
});
const statusColor = computed(() => {
  if (compositeScore.value < 25) return LEVELS.safe.color;
  if (compositeScore.value < 50) return LEVELS.watch.color;
  if (compositeScore.value < 75) return LEVELS.warning.color;
  return LEVELS.alert.color;
});

function getRangeText(key) {
  const map = { safe: '00-25', watch: '25-50', warning: '50-75', alert: '75-100' };
  return map[key] || '';
}

/**
 * 专业级四级预警评价引擎 (Academic-Grade Grading Engine)
 * 依据: 参考《国土空间规划监测评估年度报告技术指南》及相关 LUCC 土地利用变化研究论文
 * 
 * @param {number} val - 计算出的指标原始值
 * @param {number[]} breaks - 阈值断点 [b1, b2, b3]
 * @param {boolean} ascending - 属性趋势 (true: 越大越危险; false: 越小越危险)
 * @returns {{ level: string, score: number }} 预警等级与归一化分值
 */
function getThresholdLevel(val, breaks, ascending = true) {
  const [b1, b2, b3] = breaks;
  let score = 0;
  if (ascending) {
    // 升序指标 (如碳代谢压力)：值越高，风险越大。安全区 0~25
    if (val <= b1)      { score = (val / b1) * 25; return { level: 'safe', score: Math.max(0, Math.min(25, score)) }; }
    else if (val <= b2) { score = 25 + ((val - b1) / (b2 - b1)) * 25; return { level: 'watch', score: Math.max(25, Math.min(50, score)) }; }
    else if (val <= b3) { score = 50 + ((val - b2) / (b3 - b2)) * 25; return { level: 'warning', score: Math.max(50, Math.min(75, score)) }; }
    else                { score = 75 + ((val - b3) / b3) * 25; return { level: 'alert', score: Math.min(100, score) }; }
  } else {
    // 降序指标 (如生境质量)：值越低，风险越大。安全区 0~25
    if (val >= b1)      { 
      const maxVal = Math.max(b1 * 1.1, val); // 动态判定顶端
      score = ((maxVal - val) / (maxVal - b1 + 0.001)) * 25; 
      return { level: 'safe', score: Math.max(0, Math.min(25, score)) }; 
    }
    else if (val >= b2) { score = 25 + ((b1 - val) / (b1 - b2)) * 25; return { level: 'watch', score: Math.max(25, Math.min(50, score)) }; }
    else if (val >= b3) { score = 50 + ((b2 - val) / (b2 - b3)) * 25; return { level: 'warning', score: Math.max(50, Math.min(75, score)) }; }
    else                { score = 75 + ((b3 - val) / b3) * 25; return { level: 'alert', score: Math.min(100, score) }; }
  }
}

function setIndicator(id, rawValue, result, unit, desc) {
  const item = warningIndicators.value.find(i => i.id === id);
  if (!item) return;
  const lv = LEVELS[result.level];
  item.level = result.level;
  item.levelText = lv.text;
  item.color = lv.color;
  item.valueText = typeof rawValue === 'number' ? rawValue.toFixed(3) : rawValue;
  item.score = result.score;
  item.unit = unit;
  item.desc = desc;
}

// 监听全局区域变化
watch(() => globalStore.scope, () => {
    fetchData();
}, { deep: true });

// 监听年份变化
watch(() => props.year, () => {
    calculateWarnings();
});

async function fetchData() {
  loading.value = true;
  try {
    const { level, name } = globalStore.scope;
    
    // 1. 获取趋势数据 (保留以防后续图表需求，或单纯作为辅助记录)
    let res;
    if (level === 'province') {
        res = await clcdApi.getProvinceTrend();
    } else {
        res = await clcdApi.getRegionalTrend(level, name);
    }
    const trendList = Array.isArray(res) ? res : (res?.data || []);
    trendData.value = trendList.sort((a, b) => Number(a.year) - Number(b.year));

    // 2. 获取监测指标 (核心：从后端获取权威计算结果)
    await calculateWarnings();
    
  } catch (e) {
    console.error('Warning Dashboard fetch failed', e);
    warningIndicators.value.forEach(item => {
        item.desc = '数据获取失败，请检查网络或后端服务。';
    });
  } finally {
    loading.value = false;
  }
}

/**
 * 核心业务逻辑：指标监测预警算法
 * [重构] 现已迁移至后端 landUseService.js，此处仅负责调用并渲染。
 */
async function calculateWarnings() {
  const currentYear = Number(props.year);
  const { level, name } = globalStore.scope;

  try {
    const data = await clcdApi.getMonitoring(level, name, currentYear);
    if (!data) return;

    compositeScore.value = data.compositeScore;
    
    // 同步 4 大指标
    const m = data.metrics;
    const getLevel = (score) => score > 75 ? 'alert' : score > 50 ? 'warning' : score > 25 ? 'watch' : 'safe';

    setIndicator('hq', m.hq.value, { level: getLevel(m.hq.score), score: m.hq.score }, 'Idx', '');
    setIndicator('cmp', m.cmp.value, { level: getLevel(m.cmp.score), score: m.cmp.score }, '倍', '');
    setIndicator('eres', m.eres.value, { level: getLevel(m.eres.score), score: m.eres.score }, 'Idx', '');
    setIndicator('plec', m.plec.value, { level: getLevel(m.plec.score), score: m.plec.score }, '比', '');

    nextTick(() => {
      initGaugeChart();
    });
  } catch (e) {
    console.error('Calculate Warnings failed', e);
  }
}

function initGaugeChart() {
  if (!gaugeChartRef.value) return;
  if (!gaugeChart) {
    gaugeChart = echarts.init(gaugeChartRef.value);
  }
  
  const val = compositeScore.value.toFixed(0);
  const color = statusColor.value; 
  
  const option = {
    series: [
      // 1. 发光装饰
      {
        type: 'gauge',
        min: 0, max: 100,
        startAngle: 210, endAngle: -30,
        radius: '100%',
        center: ['50%', '55%'],
        axisLine: {
          lineStyle: {
            width: 2,
            color: [[1, 'rgba(0, 245, 255, 0.2)']]
          }
        },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        detail: { show: false },
        data: []
      },
      // 2. 主仪表盘
      {
        type: 'gauge',
        min: 0, max: 100,
        startAngle: 210, endAngle: -30,
        radius: '90%',
        center: ['50%', '55%'],
        axisLine: {
          lineStyle: {
            width: 8,
            color: [
              [0.25, '#00c864'],
              [0.50, '#f5a623'],
              [0.75, '#ff8c00'],
              [1, '#ff4757']
            ]
          }
        },
        splitLine: {
          distance: -12,
          length: 8,
          lineStyle: { color: '#fff', width: 2 }
        },
        axisTick: {
          distance: -12,
          length: 4,
          lineStyle: { color: '#fff', width: 1 }
        },
        axisLabel: { show: false },
        pointer: {
          icon: 'triangle', 
          width: 7,
          length: '65%',
          offsetCenter: [0, '8%'], 
          itemStyle: {
            color: color,
            shadowColor: color,
            shadowBlur: 10,
            shadowOffsetY: 2
          }
        },
        anchor: {
          show: true,
          showAbove: true,
          size: 16,
          itemStyle: {
            color: '#1a1a1a', 
            borderColor: color, 
            borderWidth: 3,
            shadowColor: color,
            shadowBlur: 8
          }
        },
        detail: {
          offsetCenter: [0, '35%'], 
          formatter: '{a|{value}}',
          rich: {
            a: {
              color: color,
              fontSize: 38, 
              fontFamily: 'YouSheBiaoTiHei',
              fontStyle: 'italic',
              fontWeight: 'bold',
              textShadowBlur: 10,
              textShadowColor: color,
              lineHeight: 40
            }
          }
        },
        data: [{ value: val }]
      }
    ]
  };
  
  gaugeChart.setOption(option);
}

onMounted(fetchData);
watch(() => props.year, calculateWarnings);
</script>

<style scoped>
/* ===== 核心容器：切角工业风 ===== */
.right-panel-container {
  width: 480px;
  height: 760px; /* 固化高度，与左侧面板保持强制对称 */
  position: relative;
  padding: 36px 30px 30px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  user-select: none;
  -webkit-user-select: none;
  overflow: visible;

  /* 此处不再设置 clip-path，改由 ::before 伪元素设置，以允许子元素（如提示框）溢出边界 */
}

/* 毛玻璃背板 (::before 同步切角) */
.right-panel-container::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px));
  /* 恢复玻璃感深海蓝叠加，禁用底部模糊以保证极简纯净的地图穿透感 */
  /* 采用与左侧面板完全同步的增强型玻璃感参数 */
  background: linear-gradient(135deg, rgba(10, 25, 70, 0.78) 0%, rgba(15, 35, 80, 0.62) 100%);
  backdrop-filter: blur(28px) saturate(190%);
  -webkit-backdrop-filter: blur(28px) saturate(190%);
  border: 1.5px solid rgba(0, 245, 255, 0.4);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 30px rgba(0, 245, 255, 0.12);
}

/* 切角装饰点 (强调科技感) */
.corner-decor {
  position: absolute;
  width: 6px; height: 6px;
  background: #00f5ff;
  box-shadow: 0 0 8px #00f5ff;
  z-index: 10;
}
.top-right { top: 0; right: 22px; }
.bottom-left { bottom: 22px; left: 0; }

/* ===== 内容区域 ===== */
.warning-section {
  display: flex;
  flex-direction: column;
  gap: 8px; /* 进一步压缩区块间距 */
  height: 100%;
}

/* 标题行 */
.section-header {
  display: flex;
  align-items: center;
  position: relative;
  padding-bottom: 8px; /* 标题行也收缩留白 */
  margin-bottom: 4px;
}
.title-decor {
  width: 4px; height: 20px;
  background: #f5a623;
  border-radius: 1px;
  box-shadow: 0 0 10px rgba(245,166,35,0.9), 0 0 20px rgba(245,166,35,0.5);
  margin-right: 14px;
}
.header-text {
  font-size: 20px; font-weight: 700;
  letter-spacing: 3px; color: #fff;
  text-shadow: 0 0 15px rgba(245, 166, 35, 0.4);
}
.header-line {
  position: absolute; bottom: 0; left: 0; width: 100%; height: 1px;
  background: linear-gradient(90deg, rgba(245, 166, 35, 0.7) 0%, rgba(0, 245, 255, 0.3) 50%, transparent 100%);
}

.gauge-hero-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  margin-top: 4px;
}

.hero-standard-col {
  width: 130px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.standard-title {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 1px;
  text-transform: uppercase;
}

.threshold-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.threshold-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-bar {
  width: 4px;
  height: 24px;
  border-radius: 2px;
}

.level-info {
  display: flex;
  flex-direction: column;
}

.level-range {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'Orbitron', monospace;
}

.level-tag {
  font-size: 13px;
  font-weight: 500;
}

.hero-gauge-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.echarts-gauge-box {
  width: 100%;
  height: 190px;
}

.gauge-status-badge {
  margin-top: -20px; /* 取消负边距，彻底解决重叠 */
  z-index: 10;
}

.status-bg {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 16px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid transparent;
  border-radius: 20px;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 1px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.composite-info {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.score-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.score-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.score-val {
  font-size: 26px;
  font-weight: bold;
  font-family: 'Orbitron', sans-serif;
  font-style: italic;
}

.score-max {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.4);
}

.score-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
}

/* 分割线 */
.divider-line {
  height: 1px;
  background: linear-gradient(90deg, rgba(0,245,255,0.4) 0%, rgba(0,245,255,0.1) 60%, transparent 100%);
  margin-bottom: 6px; /* 压缩下边距 */
  flex-shrink: 0;
}

/* ===== 指标卡片网格 (还原定制版) ===== */
.indicators-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  row-gap: 20px; /* 加大第一行与第二行的间距 */
  column-gap: 12px;
  margin-top: auto; /* 使用 auto 自动吸收上方全部剩余空间，将网格牢牢压在主容器最下端 */
  flex-shrink: 0; 
}
.indicator-card {
  position: relative;
  padding: 16px 20px 16px; /* 减小下边距 */
  min-height: 80px; /* 减小最小高度 */
  /* 用户自定义颜色: RGB(52, 131, 241) Alpha 75% */
  background: rgba(52, 131, 241, 0.75);
  border: 1px solid rgba(0, 245, 255, 0.3);
  border-left: 2px solid var(--card-accent, rgba(255,255,255,0.2));
  /* 小切角 */
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
  transition: background 0.3s, transform 0.3s, border-color 0.3s;
}
.indicator-card:hover {
  background: rgba(52, 131, 241, 0.95);
  transform: translateY(-3px);
  border-color: rgba(0, 245, 255, 0.6);
}

/* 卡片右上角切角标记 */
.card-clip-mark {
  position: absolute;
  top: 0; right: 10px;
  width: 8px; height: 8px;
  background: var(--card-accent, rgba(255,255,255,0.3));
  opacity: 0.6;
}

.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  gap: 4px;
}
.card-name {
  font-size: 13px;
  color: rgba(255,255,255,0.95);
  font-weight: 600;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1; /* allow shrinking while pushing badge left if needed, but flex:1 pushes it right mostly */
}
.card-status-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.card-score-tag {
  font-size: 11px;
  padding: 2px 6px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 3px;
  background: rgba(0,0,0,0.25);
  font-family: 'Orbitron', monospace;
  display: inline-block;
  margin-bottom: 8px;
}
.badge-light {
  width: 5px; height: 5px; border-radius: 50%;
  animation: breathe 2s infinite ease-in-out;
}
.badge-text {
  font-size: 11px; font-weight: 700;
}

.card-metric-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 8px;
}
.metric-big-num {
  font-family: 'YouSheBiaoTiHei', sans-serif;
  font-size: 30px;
  font-style: italic;
  padding-right: 8px; /* 关键：给倾斜字体预留空间，防止右侧截断 */
  color: #fff;
  background: linear-gradient(180deg, #fff 0%, color-mix(in srgb, var(--card-accent) 60%, white) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));
  line-height: 1;
}
.metric-unit {
  font-size: 13px; color: rgba(255,255,255,0.6);
}

.card-desc-row {
  font-size: 11px;
  color: rgba(255,255,255,0.65);
  line-height: 1.4;
  padding-top: 6px; /* 稍减内部文字框的空隙 */
  border-top: 1px solid rgba(255,255,255,0.15);
}

@keyframes breathe {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.8); }
}

/* ===== 公式悬浮提示 (Formula Tooltip) ===== */
.has-tooltip {
  position: relative;
}

.formula-tooltip {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -60%);
  width: 280px; /* 增加宽度防止换行导致符号“歪倒” */
  padding: 12px 16px;
  background: rgba(52, 131, 241, 0.95); /* 修改为与卡片一致的蓝色调 */
  border: 1px solid rgba(0, 245, 255, 0.6);
  border-radius: 4px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(52, 131, 241, 0.3);
  z-index: 100;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(12px);
}

.has-tooltip:hover .formula-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, -50%);
}

.indicator-wrapper {
  position: relative;
  width: 100%;
}

.indicator-card {
  position: relative;
  width: 100%;
  padding: 16px 20px 20px;
  min-height: 124px;
/* ... rest ... */
}

/* 针对卡片的特殊定位 */
.card-tip {
  bottom: 100%;
  top: auto;
  left: 50%;
  transform: translate(-50%, -10px);
}
.indicator-wrapper:hover .card-tip {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, -20px);
}

/* 针对综合指数的特殊定位 */
.composite-info .formula-tooltip {
  top: -20px;
}
.composite-info:hover .formula-tooltip {
  transform: translate(-50%, -100%);
}

.formula-title {
  font-size: 11px;
  color: #fff; /* 标题改为白色 */
  margin-bottom: 6px;
  font-weight: bold;
  border-bottom: 1px solid rgba(0, 245, 255, 0.2);
  padding-bottom: 4px;
  text-align: center; /* 标题居中 */
}

.formula-content, .formula-body {
  font-family: inherit; /* 改回继承字体，Courier New 有时会导致符号渲染异常 */
  font-size: 13px;
  color: #fff;
  line-height: 1.6;
  text-align: center;
  white-space: nowrap; /* 强制不换行，彻底解决符号折断问题 */
}
</style>
