<template>
  <div class="right-panel-container">
    <!-- 顶部切角装饰线 (模拟有棱有角的工业感边框) -->
    <div class="corner-decor top-right"></div>
    <div class="corner-decor bottom-left"></div>

    <section class="warning-section">
      <!-- 标题区 -->
      <div class="section-header">
        <div class="title-decor"></div>
        <span class="header-text">预警·风险监测</span>
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

      <div class="composite-info has-tooltip">
        <div class="score-row">
          <span class="score-label">综合风险指数</span>
          <span class="score-val" :style="{ color: statusColor }">{{ compositeScore.toFixed(0) }}</span>
          <span class="score-max">/ 100</span>
        </div>
        <div class="score-desc">
          基于耕地保有、建设扩张、耕林转换、生态屏障 4 项核心规划指标加权评估
        </div>
        <!-- 综合指数公式提示 -->
        <div class="formula-tooltip">
          <div class="formula-title">综合评价逻辑 (MCE 加权)</div>
          <div class="formula-body">
            45% 耕地保有 + 15% 建设扩张 + <br/>
            20% 耕林置换 + 20% 生态屏障
          </div>
        </div>
      </div>

      <!-- 指标分隔线 -->
      <div class="divider-line"></div>

      <!-- 指标详情卡片网格 -->
      <div class="indicators-grid">
        <div v-for="item in warningIndicators" :key="item.id" class="indicator-wrapper has-tooltip">
          <!-- 实际显示的卡片内容 (带切角背景) -->
          <div class="indicator-card" :style="{ '--card-accent': item.color }">
            <div class="card-clip-mark"></div>
            
            <div class="card-header-row">
              <span class="card-name">{{ item.title }}</span>
              <div class="card-status-info">
                <div class="card-status-badge">
                  <span class="badge-light" :style="{ backgroundColor: item.color }"></span>
                  <span class="badge-text" :style="{ color: item.color }">{{ item.levelText }}</span>
                </div>
                <div class="card-score-tag" :style="{ color: item.color, borderColor: `${item.color}40` }">
                  风险分: {{ item.score.toFixed(1) }}
                </div>
              </div>
            </div>

            <div class="card-metric-row">
              <span class="metric-big-num">{{ item.valueText }}</span>
              <span class="metric-unit">{{ item.unit }}</span>
            </div>

            <div class="card-desc-row">
              {{ item.desc }}
            </div>
          </div>

          <!-- 指标公式提示 (在卡片外层，不受 clip-path 影响) -->
          <div class="formula-tooltip card-tip">
            <div class="formula-title">核算公式 ({{ item.title }})</div>
            <div class="formula-content">{{ item.formula }}</div>
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
  { id: 'cropland', title: '耕地保有红线', level: 'safe', levelText: '安全', color: '#00c864', valueText: '0.00', score: 0, unit: '%',  desc: '正在计算中...', formula: '(当前耕地 / 1985年耕地) × 100%' },
  { id: 'urban',    title: '建设用地扩张', level: 'safe', levelText: '安全', color: '#00c864', valueText: '0.00', score: 0, unit: 'x',  desc: '正在计算中...', formula: '当前扩张速度 / 历史平均增速' },
  { id: 'swap',     title: '耕林空间置换', level: 'safe', levelText: '安全', color: '#00c864', valueText: '0.00', score: 0, unit: '%',  desc: '正在计算中...', formula: '(|耕地变化| + |林地变化|) / (2 × 总面积 × 步长)' },
  { id: 'eco',      title: '生态安全屏障', level: 'safe', levelText: '安全', color: '#00c864', valueText: '0.00', score: 0, unit: '%',  desc: '正在计算中...', formula: '(当前林地 / 1985年林地) × 100%' }
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
  if (ascending) {
    // 升序指标 (如扩张率)：值越高，风险越大
    if (val <= b1) return { level: 'safe',    score: (val / b1) * 25 };
    if (val <= b2) return { level: 'watch',   score: 25 + ((val - b1) / (b2 - b1)) * 25 };
    if (val <= b3) return { level: 'warning', score: 50 + ((val - b2) / (b3 - b2)) * 25 };
    return { level: 'alert', score: Math.min(75 + ((val - b3) / b3) * 25, 100) };
  } else {
    // 降序指标 (如保有率)：值越低，风险越大
    if (val >= b1) return { level: 'safe',    score: Math.max(0, (1 - (b1 - val) / (b1 * 0.1)) * 25) }; 
    if (val >= b2) return { level: 'watch',   score: 25 + ((b1 - val) / (b1 - b2)) * 25 };
    if (val >= b3) return { level: 'warning', score: 50 + ((b2 - val) / (b2 - b3)) * 25 };
    return { level: 'alert', score: Math.min(75 + ((b3 - val) / b3) * 25, 100) };
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

async function fetchData() {
  loading.value = true;
  try {
    const res = await clcdApi.getProvinceTrend();
    // 基础请求 request() 已在内部处理了 .data 解包，res 直接就是数组
    const trendList = Array.isArray(res) ? res : (res?.data || []);
    
    if (trendList.length > 0) {
      trendData.value = trendList.sort((a, b) => Number(a.year) - Number(b.year));
      calculateWarnings();
    } else {
      console.warn('[WarningDashboard] No trend data returned from API');
      // 给用户一个反馈，不要卡在“正在计算中”
      warningIndicators.value.forEach(item => {
        item.desc = '暂无历史序列数据，无法计算风险趋势。';
      });
    }
  } catch (e) {
    console.error('Warning Dashboard fetch failed', e);
    warningIndicators.value.forEach(item => {
        item.desc = '数据获取失败，请检查网络或后端服务。';
    });
  } finally {
    loading.value = false;
  }
}

/* 
  核心业务逻辑：指标监测预警算法
  [数据合规性声明] 指标计算必须严格基于后端接口 (clcdApi.getProvinceTrend) 返回的真实物理地类面积。
  禁止使用任何 Math.random() 或模拟占位数据。
*/
/* 
  核心业务逻辑：国土空间规划/LUCC 监测预警算法
  算法引证: 
  - 耕地保有: 基于"永久基本农田保护红线"制度
  - 建设扩张: 基于"城镇开发边界(UDB)"与扩张强度指数 (UEII)
  - 耕林转换: 基于"边缘效应"与"土地转类稳定性"研究
  [数据声明] 严禁捏造，所有指标均基于 clcdApi 获取的真实时空序列数据计算。
*/
function calculateWarnings() {
  const currentYear = Number(props.year);
  const trendList = trendData.value || [];
  if (!trendList.length) return;

  const curr = trendList.find(d => Number(d.year) === currentYear);
  const base = trendList.find(d => Number(d.year) === 1985) || trendList[0];
  const prev = trendList.filter(d => Number(d.year) < currentYear).sort((a, b) => Number(b.year) - Number(a.year))[0] || curr;
  if (!curr || !base) return;

  const T_total = currentYear - Number(base.year) || 1;
  const T_step = currentYear - Number(prev.year) || 1;
  const norm = (val) => Number(val || 0) / 1000000;
  const landTypes = ['cropland', 'forest', 'shrub', 'grassland', 'water', 'wetland', 'impervious', 'barren', 'snow_ice'];
  
  let totalArea = 0;
  landTypes.forEach(t => { totalArea += norm(curr[t]); });

  // 1. 🌾 耕地保有红线 (Cropland Retention)
  // 参考阈值: 依据规划底线，保有率低于 95% 视为生态压力显著 (Zhang et al., 2021)
  const cCurr = norm(curr.cropland), cBase = norm(base.cropland);
  const cRetain = cBase > 0 ? (cCurr / cBase) * 100 : 100;
  const cResult = getThresholdLevel(cRetain, [98, 95, 92], false); // 越小越危险
  setIndicator('cropland', cRetain, cResult, '%', 
    cResult.level === 'safe'    ? '耕地保有率极高，基本农田保护红线稳固。' :
    cResult.level === 'watch'   ? '耕地存量出现微弱下行，需警惕非农化倾向。' :
    cResult.level === 'warning' ? '耕地保有已触及预警线，建议限制占补平衡审批。' :
                                  '耕地大幅跌破红线，粮食安全底线已受威胁！');

  // 2. 🏗️ 建设用地扩张强度 (Urban Sprawl Intensity)
  const uCurr = norm(curr.impervious), uBase = norm(base.impervious), uPrev = norm(prev.impervious);
  const histAvgRate = (uCurr - uBase) / T_total;
  const currRate = (uCurr - uPrev) / T_step;
  const sprawlRatio = histAvgRate > 0 ? currRate / histAvgRate : 1.0;
  const uResult = getThresholdLevel(sprawlRatio, [1.2, 1.8, 2.5], true);
  setIndicator('urban', sprawlRatio, uResult, 'x',
    uResult.level === 'safe'    ? '城镇扩张节奏平稳，土地利用集约度良好。' :
    uResult.level === 'watch'   ? '增长速度略有超前，需审视开发边界饱和度。' :
    uResult.level === 'warning' ? '城镇蔓延明显加速，存在空间管控失效风险。' :
                                  '建设用地爆发式增长，空间秩序面临严重混乱！');

  // 3. 🔃 耕林空间置换 (Crop-Forest Swap Intensity)
  const cDelta = Math.abs(norm(curr.cropland) - norm(prev.cropland));
  const fDelta = Math.abs(norm(curr.forest) - norm(prev.forest));
  const swapVal = totalArea > 0 ? ((cDelta + fDelta) / (2 * totalArea * T_step)) * 100 : 0;
  const sResult = getThresholdLevel(swapVal, [0.1, 0.3, 0.6], true);
  setIndicator('swap', swapVal, sResult, '%',
    sResult.level === 'safe'    ? '农林系统格局稳健，空间置换处于极低水平。' :
    sResult.level === 'watch'   ? '局部活跃，存在季节性或政策性农林微调。' :
    sResult.level === 'warning' ? '耕林地块频繁更替，空间边界灵活性过高。' :
                                  '耕林大规模剧烈互转，土地利用权属严重冲突！');

  // 4. 🛡️ 生态安全屏障 (Ecological Shield Status)
  const fCurr = norm(curr.forest), fBase = norm(base.forest);
  const eRetain = fBase > 0 ? (fCurr / fBase) * 100 : 100;
  const eResult = getThresholdLevel(eRetain, [100, 97, 94], false);
  setIndicator('eco', eRetain, eResult, '%',
    eResult.level === 'safe'    ? '生态基板稳固，绿色屏障调节功能发挥正常。' :
    eResult.level === 'watch'   ? '林地出现局部侵蚀，建议加强封山育林。' :
    eResult.level === 'warning' ? '森林覆盖持续退化，生态系统服务能力受损。' :
                                  '生态格局严重碎片化，绿色屏障面临崩溃风险！');

  // 综合计算加权风险分 (校准版: 耕地保护优先策略)
  compositeScore.value = cResult.score * 0.45 + uResult.score * 0.15 + sResult.score * 0.2 + eResult.score * 0.2;

  nextTick(() => {
    initGaugeChart();
  });
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
      // 1. 发光外环 (装饰用)
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
          icon: 'triangle', // 改为充实的科幻实心指针
          width: 7,
          length: '65%',
          offsetCenter: [0, '8%'], // 指针尾部略微下拉，与底座咬合
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
            color: '#1a1a1a', // 黑色机械底座
            borderColor: color, // 发光边缘
            borderWidth: 3,
            shadowColor: color,
            shadowBlur: 8
          }
        },
        detail: {
          offsetCenter: [0, '35%'], // 进一步上移数字，彻底拉开与下方徽章的距离
          formatter: '{a|{value}}',
          rich: {
            a: {
              color: color,
              fontSize: 38, // 没了副标题，主数字可以稍微大一点点
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

  /* 注意：此处不再设置 clip-path，改由 ::before 伪元素设置，以允许子元素（如提示框）溢出边界 */
}

/* 毛玻璃背板 (::before 同步切角) */
.right-panel-container::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px));
  /* 恢复玻璃感深海蓝叠加，禁用底部模糊以保证极简纯净的地图穿透感 */
  background: linear-gradient(135deg, rgba(10, 25, 70, 0.75) 0%, rgba(15, 35, 80, 0.6) 100%);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1.5px solid rgba(0, 245, 255, 0.4);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 24px rgba(0, 245, 255, 0.08);
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
  margin-top: 10px; /* 将整个网格往下移动一点 */
  flex-shrink: 0; 
}
.indicator-card {
  position: relative;
  padding: 16px 20px 20px; /* 增加左右内边距，防止文字溢出被 clip-path 裁掉 */
  min-height: 124px; /* 确保卡片不会被压缩截断文字 */
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
  margin-bottom: 12px;
}
.card-name {
  font-size: 13px; color: rgba(255,255,255,0.9);
  font-weight: 500; letter-spacing: 0.5px;
}
.card-status-info {
  display: flex;
  flex-direction: column; /* 垂直排列，腾出空间展示得分 */
  align-items: flex-end;
  gap: 4px;
}
.card-status-badge {
  display: flex;
  align-items: center;
  gap: 5px;
}
.card-score-tag {
  font-size: 10px;
  padding: 0 4px;
  border: 0.5px solid rgba(255,255,255,0.2);
  border-radius: 2px;
  background: rgba(0,0,0,0.2);
  font-family: monospace;
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
