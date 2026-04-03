<!--
  @component DashboardLeftPanel
  @description 核心数据看板左侧面板 - 美化重制版
  @props year (当前年份), theme (显示主题)
  @emits update:year (更新年份)
  @dependencies analysisApi (数据接口)
-->
<template>
  <div class="tech-panel-container">
    <!-- 切角装饰点 (强调科技感，与右面板对称) -->
    <div class="corner-decor top-left"></div>
    <div class="corner-decor bottom-right"></div>

    <section class="analysis-section">
      <div class="panel-content" v-if="metrics">
        
        <!-- ================= Section 1: 格局演变 ================= -->
        <div class="data-section">
          <div class="section-header">
            <div class="title-decor"></div>
            <span class="header-text">格局演变</span>
            <div class="header-line"></div>
          </div>
          
          <div class="metrics-list">
            <!-- 耕地面积 -->
            <div class="data-row">
              <div class="icon-box">
                 <img :src="iconCropland" class="custom-icon" alt="耕地" />
              </div>
              <div class="label">耕地面积</div>
              <div class="value-box">
                <span class="value">{{ metrics.croplandArea.value }}</span>
                <span class="unit">km²</span>
              </div>
              <div class="trend" :class="metrics.croplandArea.trend >= 0 ? 'up':'down'">
                <svg class="trend-art-arrow" viewBox="0 0 24 24">
                  <path v-if="metrics.croplandArea.trend >= 0" d="M12 2 L4 14 L9 12 L9 22 L15 22 L15 12 L20 14 Z"/>
                  <path v-else d="M12 22 L4 10 L9 12 L9 2 L15 2 L15 12 L20 10 Z"/>
                </svg>
                <span>{{ Math.abs(metrics.croplandArea.trend).toFixed(2) }}</span>
              </div>
            </div>

            <!-- 建设用地面积 -->
            <div class="data-row">
              <div class="icon-box">
                 <img :src="iconUrban" class="custom-icon" alt="建设用地" />
              </div>
              <div class="label">建设用地面积</div>
              <div class="value-box">
                <span class="value">{{ metrics.urbanArea.value }}</span>
                <span class="unit">km²</span>
              </div>
              <div class="trend" :class="metrics.urbanArea.trend >= 0 ? 'up':'down'">
                <svg class="trend-art-arrow" viewBox="0 0 24 24">
                  <path v-if="metrics.urbanArea.trend >= 0" d="M12 2 L4 14 L9 12 L9 22 L15 22 L15 12 L20 14 Z"/>
                  <path v-else d="M12 22 L4 10 L9 12 L9 2 L15 2 L15 12 L20 10 Z"/>
                </svg>
                <span>{{ Math.abs(metrics.urbanArea.trend).toFixed(2) }}</span>
              </div>
            </div>

            <!-- 林地面积 -->
            <div class="data-row">
              <div class="icon-box">
                 <img :src="iconForest" class="custom-icon" alt="林地" />
              </div>
              <div class="label">林地面积</div>
              <div class="value-box">
                <span class="value">{{ metrics.forestArea?.value || 0 }}</span>
                <span class="unit">km²</span>
              </div>
              <div class="trend" :class="(metrics.forestArea?.trend || 0) >= 0 ? 'up':'down'">
                <svg class="trend-art-arrow" viewBox="0 0 24 24">
                  <path v-if="(metrics.forestArea?.trend || 0) >= 0" d="M12 2 L4 14 L9 12 L9 22 L15 22 L15 12 L20 14 Z"/>
                  <path v-else d="M12 22 L4 10 L9 12 L9 2 L15 2 L15 12 L20 10 Z"/>
                </svg>
                <span>{{ Math.abs(metrics.forestArea?.trend || 0).toFixed(2) }}</span>
              </div>
            </div>

            <!-- 扩张速率 -->
            <div class="data-row">
              <div class="icon-box">
                 <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 21h8"></path><path d="M5 21V5a2 2 0 012-2h4a2 2 0 012 2v16"></path><path d="M13 21v-8h4v8"></path></svg>
              </div>
              <div class="label">城市扩张速率</div>
              <div class="value-box">
                <span class="value">{{ (metrics.urbanDynamic?.value || 0).toFixed(0) }}</span>
                <span class="unit">km²/yr</span>
              </div>
              <div class="trend" :class="(metrics.urbanDynamic?.trend || 0) >= 0 ? 'up':'down'">
                <svg class="trend-art-arrow" viewBox="0 0 24 24">
                  <path v-if="(metrics.urbanDynamic?.trend || 0) >= 0" d="M12 2 L4 14 L9 12 L9 22 L15 22 L15 12 L20 14 Z"/>
                  <path v-else d="M12 22 L4 10 L9 12 L9 2 L15 2 L15 12 L20 10 Z"/>
                </svg>
                <span>{{ Math.abs(metrics.urbanDynamic?.trend || 0).toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ================= Section 2: 动态特征 ================= -->
        <div class="data-section">
          <div class="section-header">
            <div class="title-decor"></div>
            <span class="header-text">动态特征</span>
            <div class="header-line"></div>
          </div>
          
          <div class="metrics-list">
            <!-- 耕地动态度 -->
            <div class="data-row">
              <div class="icon-box">
                 <img :src="iconCropland" class="custom-icon" alt="耕地" />
              </div>
              <div class="label">耕地动态度</div>
              <div class="trend" :class="metrics.croplandArea.trend >= 0 ? 'up':'down'">
                <span class="dynamic-value">{{ metrics.croplandDynamic }}</span>
                <span class="unit-percent">%</span>
              </div>
            </div>
            
            <!-- 建设用地动态度 -->
            <div class="data-row">
              <div class="icon-box">
                 <img :src="iconUrban" class="custom-icon" alt="建设用地" />
              </div>
              <div class="label">建设用地动态度</div>
              <div class="trend" :class="metrics.urbanArea.trend >= 0 ? 'up':'down'">
                <span class="dynamic-value">{{ metrics.urbanDynamicVal }}</span>
                <span class="unit-percent">%</span>
              </div>
            </div>

            <!-- 林地动态度 -->
            <div class="data-row">
              <div class="icon-box">
                 <img :src="iconForest" class="custom-icon" alt="林地" />
              </div>
              <div class="label">林地动态度</div>
              <div class="trend" :class="(metrics.forestTrend || 0) >= 0 ? 'up':'down'">
                <span class="dynamic-value">{{ metrics.forestDynamic }}</span>
                <span class="unit-percent">%</span>
              </div>
            </div>

            <!-- 综合动态度 -->
            <div class="data-row highlight-row">
              <div class="icon-box highlight">
                 <img :src="iconLand" class="custom-icon" alt="综合" />
              </div>
              <div class="label">综合土地动态度</div>
              <div class="trend" :class="(metrics.lcTrend || 0) >= 0 ? 'up':'down'">
                <span class="dynamic-value">{{ metrics.lcDynamic }}</span>
                <span class="unit-percent">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { clcdApi, analysisApi } from '../../api/index.js'; 
import iconCropland from '@/assets/icons/business/cropland.png';
import iconUrban from '@/assets/icons/business/urban.png';
import iconForest from '@/assets/icons/business/forest.png';
import iconLand from '@/assets/icons/business/land.png';

const props = defineProps({
  year: { type: Number, default: 2023 },
  theme: { type: String, default: 'optimization' }
});
const emit = defineEmits(['update:year']);

const loading = ref(true);

watch(() => props.theme, (newTheme) => {
  console.log(`[LeftPanel] Theme switched to: ${newTheme}`);
  fetchData();
});

const metrics = ref({
    croplandArea: { value: 0, trend: 0 },
    urbanArea: { value: 0, trend: 0 },
    ecoArea: { value: 0, trend: 0 },
    croplandDynamic: '0.000',
    urbanDynamicVal: '0.000',
    urbanDynamic: { value: 0, trend: 0 },
    forestDynamic: '0.000',
    lcDynamic: '0.000',
    forestTrend: 0
});

async function fetchData() {
  loading.value = true;
  try {
    // 切换至 clcdApi 获取时序数据，实现与 K 线图完全一致的 YoY 同源计算
    const trendRes = await clcdApi.getProvinceTrend();
    const trendList = Array.isArray(trendRes) ? trendRes : (trendRes?.data || []);
    
    // 定位年度数据：当前年 vs 最近的前一个可用年份（处理 1985-1990 这种跨度）
    const currentYear = Number(props.year);
    const curr = trendList.find(i => Number(i.year) === currentYear);
    const prev = trendList
      .filter(i => Number(i.year) < currentYear)
      .sort((a, b) => Number(b.year) - Number(a.year))[0] || curr;
    
    // 计算实际跨度 T
    const T = (curr && prev) ? (Number(curr.year) - Number(prev.year) || 1) : 1;

    if (curr && prev) {
       // 全地类解析
       const landTypes = ['cropland', 'forest', 'shrub', 'grassland', 'water', 'wetland', 'impervious', 'barren', 'snow_ice'];
       
       const cVal = Number(curr.cropland || 0);
       const pVal = Number(prev.cropland || 0);
       const uVal = Number(curr.impervious || 0);
       const upVal = Number(prev.impervious || 0);
       
       // 3. 林地面积 (Forest ONLY - 必须与时序演化图一致)
       const fVal = Number(curr.forest || 0);
       const fpVal = Number(prev.forest || 0);
       metrics.value.forestArea = { 
         value: (fVal / 1000000).toFixed(2), 
         trend: (fVal - fpVal) / 1000000
       };
       metrics.value.forestTrend = (fVal - fpVal) / 1000000;

       // 4. 生态面积 (Forest + Shrub + Grassland + Water + Wetland - 系统综合指标)
       const getEco = (data) => ['forest', 'shrub', 'grassland', 'water', 'wetland']
         .reduce((sum, key) => sum + Number(data[key] || 0), 0);
       
       const eVal = getEco(curr);
       const epVal = getEco(prev);
       metrics.value.ecoArea = { 
         value: (eVal / 1000000).toFixed(2), 
         trend: (eVal - epVal) / 1000000
       };

       // 1. 格局演变 (显示总量及总增减，单位 km2)
       metrics.value.croplandArea = { 
         value: (cVal / 1000000).toFixed(2), 
         trend: (cVal - pVal) / 1000000 
       };

       metrics.value.urbanArea = { 
         value: (uVal / 1000000).toFixed(2), 
         trend: (uVal - upVal) / 1000000 
       };

       // 2. 城市扩张速率：专属年均速率 (km2/yr)
       metrics.value.urbanDynamic = { 
         value: (uVal - upVal) / (1000000 * T), 
         trend: (uVal - upVal) / 1000000 
       };

       // 5. 动态特征 (按定义均需除以 T，反映年均活跃度 %)
       metrics.value.croplandDynamic = pVal ? ((cVal - pVal) / pVal / T * 100).toFixed(3) : '0.000';
       metrics.value.urbanDynamicVal = upVal ? ((uVal - upVal) / upVal / T * 100).toFixed(3) : '0.000';
       metrics.value.forestDynamic = fpVal ? ((fVal - fpVal) / fpVal / T * 100).toFixed(3) : '0.000';

       // 4. 综合土地利用动态度
       let totalChange = 0;
       let totalStart = 0;
       landTypes.forEach(type => {
         const start = Number(prev[type] || 0);
         const end = Number(curr[type] || 0);
         totalChange += Math.abs(end - start);
         totalStart += start;
       });
       metrics.value.lcTrend = totalChange / 1000000;
       metrics.value.lcDynamic = (totalStart && T) ? (totalChange / (2 * totalStart) / T * 100).toFixed(3) : '0.000';
    } else {
       console.warn(`[LeftPanel] 未找到 ${currentYear} 年的数据`);
       metrics.value = {
         croplandArea: { value: 0, trend: 0 },
         urbanArea: { value: 0, trend: 0 },
         ecoArea: { value: 0, trend: 0 },
         croplandDynamic: '0.000',
         urbanDynamicVal: '0.000',
         urbanDynamic: { value: 0, trend: 0 },
         forestDynamic: '0.000',
         lcDynamic: '0.000',
         forestTrend: 0,
         forestArea: 0
       };
    }

    analysisApi.getDashboardData(props.year, 'comprehensive').catch(() => {});
  } catch (e) {
    console.error('DashboardLeftPanel fetch failed', e);
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);
watch(() => props.year, fetchData);
</script>

<style scoped>
/* =========== 基础容器 =========== */
.tech-panel-container {
  width: 480px;
  height: 760px; /* 固化高度，与右侧面板保持强制对称 */
  position: relative;
  overflow: visible;
  padding: 36px 30px 30px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  user-select: none;
  -webkit-user-select: none;
  
  /* 切角多边形：对称的左上、右下切角，匹配右侧面板 */
  clip-path: polygon(22px 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%, 0 22px);
}

.tech-panel-container::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  /* 切角背板，与外壳完全同步 */
  clip-path: polygon(22px 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%, 0 22px);
  
  /* 恢复玻璃感深海蓝叠加，禁用底部模糊以保证极简纯净的地图穿透感 */
  background: linear-gradient(135deg, rgba(10, 25, 70, 0.7) 0%, rgba(15, 35, 80, 0.5) 100%);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: 1.5px solid rgba(0, 245, 255, 0.6);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 24px rgba(0, 245, 255, 0.08);
}

/* 切角装饰点 (强调科技感，与右面板对称) */
.corner-decor {
  position: absolute;
  width: 6px; height: 6px;
  background: #00f5ff;
  box-shadow: 0 0 8px #00f5ff;
  z-index: 10;
}
.top-left { top: 0; left: 22px; }
.bottom-right { bottom: 22px; right: 0; }

.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px; /* 减小间距，防止内部元素被过度挤到下方 */
  position: relative;
  z-index: 5;
}

/* =========== 标题区域 =========== */
.data-section {
  display: flex;
  flex-direction: column;
  gap: 12px; /* 自然堆叠区块内容 */
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
  font-size: 22px; /* 略微增大字号 */
  font-weight: 600;
  letter-spacing: 2.5px;
  color: #ffffff;
  text-shadow: 0 0 12px rgba(245, 166, 35, 0.4);
}

.header-line {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, rgba(245, 166, 35, 0.6) 0%, transparent 80%);
}

/* =========== 数据列表与行 =========== */
.metrics-list {
  display: flex;
  flex-direction: column;
}

.data-row {
  display: grid;
  grid-template-columns: 32px 1fr auto 100px;
  align-items: center;
  padding: 12px 10px; /* 略微压缩单行高度，避免底部越界贴边 */
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: default;
}

.data-row:last-child {
  border-bottom: none;
}

/* 悬浮交互效果 */
.data-row:hover {
  background: linear-gradient(90deg, rgba(0, 242, 255, 0.08) 0%, transparent 100%);
  transform: translateX(4px);
  border-color: transparent;
}

.data-row:hover .icon-box {
  box-shadow: 0 0 12px rgba(0, 242, 255, 0.4);
  border-color: #00f2ff;
}

/* 图标容器：调亮底色 */
.icon-box {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(40, 70, 120, 0.6);
  border: 1px solid rgba(0, 245, 255, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  color: #c9e8ff;
  transition: all 0.3s ease;
}

.custom-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  /* 如果不需要图标全亮为白色的滤镜，可以注释掉下面这行。目前统一为原生色彩 */
  /* filter: brightness(0) invert(1); */
}

.icon-box.highlight {
  border-color: #f7b500;
  color: #f7b500;
}

.highlight-row {
  background: linear-gradient(90deg, rgba(247, 181, 0, 0.05) 0%, transparent 100%);
}

.label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  padding-left: 8px;
  white-space: nowrap; /* 强制不换行，防止截断 */
  overflow: hidden;
  text-overflow: ellipsis;
}

/* =========== 艺术数字排版: 统一面积与动态度数值样式 =========== */
.value-box, .trend {
  display: flex;
  align-items: center; 
  gap: 8px;
}

.value, .dynamic-value {
  /* 艺术字体组合 */
  font-family: 'YouSheBiaoTiHei', 'Impact', 'Arial Black', sans-serif;
  font-size: 28px; 
  font-style: italic;
  display: inline-block; 
  padding-right: 12px; 
  letter-spacing: 1px;
  overflow: visible; 
  
  /* 统一蓝银渐变 */
  background: linear-gradient(180deg, #ffffff 0%, #d1e8ff 40%, #7dbfff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  
  /* 统一发光阴影 */
  filter: drop-shadow(0px 2px 6px rgba(125, 191, 255, 0.5));
}

.unit, .unit-percent {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
  text-shadow: 0 0 4px rgba(255, 255, 255, 0.1);
}

/* =========== 趋势指示器与箭头 =========== */
.trend {
  justify-content: flex-end;
  min-width: 80px;
}

.trend span:last-child {
  font-family: 'YouSheBiaoTiHei', 'Impact', 'Arial Black', sans-serif;
  font-style: italic;
  font-size: 16px;
  letter-spacing: 0.5px;
}

.trend-art-arrow {
  width: 16px !important;
  height: 16px !important;
  flex-shrink: 0;
  fill: currentColor;
}


.trend.up {
  color: #00ff88;
  filter: drop-shadow(0 0 5px rgba(0, 255, 136, 0.4));
}

.trend.down {
  color: #ff4757;
  filter: drop-shadow(0 0 5px rgba(255, 71, 87, 0.4));
}


.dynamic-value {
  background: linear-gradient(180deg, #ffffff 0%, #d1e8ff 40%, #7dbfff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>