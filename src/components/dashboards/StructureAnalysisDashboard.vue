<!--
  @component StructureAnalysisDashboard
  @description 区域土地利用结构分析看板，展示特定年份地类构成的空间分布与数量比例
  @props year (对比年份)
  @emits 无
  @dependencies ECharts, RegionCascader, useGlobalStore, clcdApi
-->
<template>
  <div class="regional-structure-control">
    <!-- 入口按钮 -->
    <button @click="toggleModal" class="control-btn" :class="{ active: isVisible }" title="针对选定区域的土地利用结构占比分析">
      <img :src="iconUrl" alt="图标" class="icon-img" />
      <span class="btn-label">结构分析</span>
    </button>

    <Teleport to="body">
      <transition name="fade">
        <div v-if="isVisible" class="modal-backdrop" @click="closeModal"></div>
      </transition>

      <transition name="slide-fade">
        <div v-if="isVisible" class="modal-window" @click.stop>
          <div class="modal-header">
            <!-- 左侧：分析控制 (维度/切换) -->
            <!-- 左侧：分析控制 (维度/切换) - 已移除视图切换，默认进入快照模式 -->
            <div class="header-left"></div>

            <!-- 中间：核心标题 -->
            <div class="modal-title">
              <button class="year-nav-btn" @click="changeYear(-1)" :disabled="isFirstYear" title="上一年">‹</button>
              <span class="title-text">{{ selectedRegion.name }} {{ currentYear }}年 土地利用结构分析</span>
              <button class="year-nav-btn" @click="changeYear(1)" :disabled="isLastYear" title="下一年">›</button>
            </div>

            <!-- 右侧：区域选择与关闭 -->
            <div class="header-right">
              <RegionCascader 
                v-model="selectedRegion" 
                :show-level-badge="true"
                @change="handleRegionChange"
              />
              <button class="close-btn" @click="closeModal" title="关闭面板">✕</button>
            </div>
          </div>

          <div class="modal-content">
            <div class="chart-container-wrapper">
              <div v-if="isLoading" class="loading-overlay">
                <div class="spinner"></div>
                <span>正在加载 {{ selectedRegion.name }} 结构数据...</span>
              </div>
              <div ref="chartContainer" class="chart-container"></div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, shallowRef, onUnmounted, watch, nextTick, computed, onMounted } from 'vue';
import * as echarts from 'echarts';
import { centerOfMass, area } from '@turf/turf';
import bbox from '@turf/bbox';
import { clcdApi, regionApi } from '../../api/index.js';
import { useGlobalStore } from '../../stores/global';
import RegionCascader from '../cards/RegionCascader.vue';
import { CLCD_COLORS, LANDUSE_NAMES, PREFECTURE_SHORT_NAMES } from '../../constants/landuse.js';

// 导入图标
import pieIcon from '@/assets/icons/business/structure-pie.png';
const iconUrl = pieIcon;

const props = defineProps({
  year: { type: Number, default: 1985 }
});

const globalStore = useGlobalStore();
const panelName = 'RegionalStructureControl'; // 统一面板标识符

// 视图模式：固定为 rose (快照分析)
const currentView = ref('rose'); 

const currentYear = computed({
  get: () => globalStore.currentYear,
  set: (val) => globalStore.setYear(val)
});

// 优先使用全局 store 中的年份列表，保持全站一致
const availableYears = computed(() => {
  // 如果全局列表有数据则使用，否则使用本地加载的（兼顾独立性与一致性）
  const list = globalStore.yearsAll && globalStore.yearsAll.length > 0 
    ? globalStore.yearsAll 
    : localAvailableYears.value;
  return [...list].map(Number).sort((a, b) => a - b);
});

const localAvailableYears = ref([]); // 局部缓存
const isVisible = computed(() => globalStore.activePanel === panelName);
const selectedRegion = computed({
  get: () => ({
    name: globalStore.scope.name,
    level: globalStore.scope.level,
    code: globalStore.scope.code,
    // 从层级列表中推断父级（仅县级需要）
    parentName: globalStore.scope.level === 'county' 
      ? (hierarchyList.value.find(p => p.children && p.children.some(c => (c.name || c) === globalStore.scope.name))?.name || '')
      : null
  }),
  set: (val) => {
    globalStore.setScope(val.level, val.code || '', val.name);
  }
});

// 内部使用的层级列表（映射自 prefectureList 或 API）
const hierarchyList = ref([]);

const isFirstYear = computed(() => {
  if (!availableYears.value.length) return true;
  return currentYear.value <= availableYears.value[0];
});

const isLastYear = computed(() => {
  if (!availableYears.value.length) return true;
  return currentYear.value >= availableYears.value[availableYears.value.length - 1];
});

function changeYear(delta) {
  const years = availableYears.value;
  const currentIndex = years.indexOf(currentYear.value);
  
  if (currentIndex === -1) {
    if (delta > 0) {
      const next = years.find(y => y > currentYear.value);
      if (next) currentYear.value = next;
    } else {
      const prev = [...years].reverse().find(y => y < currentYear.value);
      if (prev) currentYear.value = prev;
    }
    return;
  }
  
  const nextIndex = currentIndex + delta;
  if (nextIndex >= 0 && nextIndex < years.length) {
    currentYear.value = years[nextIndex];
  }
}
const isLoading = ref(false);

const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);

// 数据缓存
let geoJSON = null;
let regionsData = []; // 用于存储当前地图中的区域信息
let landUseData = []; // 初始化为空数组而非 null，防止趋势视图 map 崩溃
let prefectureList = []; // 用于地级市代码查找
let flashInterval = null;

const landUseColors = CLCD_COLORS;
const landUseNames = LANDUSE_NAMES;

// 工具：地级市展示名称映射（防止标签过长）
const prefectureShortNames = PREFECTURE_SHORT_NAMES;

// 获取数据：GeoJSON
async function loadGeoJSON(region) {
  try {
    let url = '';
    let targetAdcode = '';
    let isLocal = false;
    
    // 名字预处理：统一去除民族和行政后缀进行模糊匹配，提高兼容性
    const cleanName = (n) => {
      if (!n) return '';
      const res = n.replace(/(白|傣|景颇|傈僳|壮|苗|彝|哈尼|回|藏|拉祜|佤|纳西|普米|怒|德昂|独龙|基诺)?(族|自治州|自治县|自治区|市|州|县|区|旗|省)/g, '');
      return res || n;
    };
    const searchName = cleanName(region.name);

    if (region.level === 'province') {
      url = '/data/yunnan_province_only.geojson';
    } else if (region.level === 'prefecture') {
      const resp = await fetch('/data/yunnan_cities_boundary.geo.json');
      const data = await resp.json();
      const pref = data.features.find(f => cleanName(f.properties.name).includes(searchName));
      if (pref) {
        geoJSON = { type: 'FeatureCollection', features: [pref] };
        isLocal = true;
      }
    } else if (region.level === 'county') {
      const prefStr = region.parentName || '';
      const pref = prefectureList.find(p => cleanName(p.name).includes(cleanName(prefStr)));
      if (pref) {
          const resp = await fetch(`/data/yunnan_all_counties.geojson`);
          const data = await resp.json();
          const county = data.features.find(f => cleanName(f.properties.name).includes(searchName));
          if (county) {
            geoJSON = { type: 'FeatureCollection', features: [county] };
            isLocal = true;
          }
      }
    }

    if (!isLocal) {
      if (!url && targetAdcode) {
        url = `https://geo.datav.aliyun.com/areas_v3/bound/${targetAdcode}.json`;
      }
      
      if (url) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('GeoJSON fetch failed');
        geoJSON = await resp.json();
      }
    }

    const feature = geoJSON.features[0];
    const name = feature.properties.name;

    // 使用物理重心算法 (centerOfMass) 代替几何质心 (centroid)，对不规则形状更友好
    const geoCenter = centerOfMass(feature).geometry.coordinates;
    
    regionsData = [{
        name,
        displayName: prefectureShortNames[name] || name,
        geoCenter, 
        area: area(feature)
    }];
  } catch (e) {
    console.error('Error loading GeoJSON:', e);
  }
}

// 获取数据：土地利用
async function loadLandUseData(region) {
  try {
    const cleanName = (n) => {
      if (!n) return '';
      const res = n.replace(/(白|傣|景颇|傈僳|壮|苗|彝|哈尼|回|藏|拉祜|佤|纳西|普米|怒|德昂|独龙|基诺)?(族|自治州|自治县|自治区|市|州|县|区|旗|省)/g, '');
      return res || n;
    };
    const searchName = cleanName(region.name);
    let data = [];
    
    if (region.level === 'province') {
      const allPrefectureData = await clcdApi.getAllPrefectureData();
      const yearsSet = [...new Set(allPrefectureData.map(d => d.year))];
      data = yearsSet.map(year => {
        const yearRecords = allPrefectureData.filter(d => d.year == year);
        const types = ['cropland', 'forest', 'shrub', 'grassland', 'water', 'wetland', 'impervious', 'barren', 'snow_ice'];
        const summary = { year };
        types.forEach(type => {
          summary[type] = yearRecords.reduce((acc, curr) => acc + (Number(curr[type]) || 0), 0);
        });
        return summary;
      });
    } else if (region.level === 'prefecture') {
      // 增强鲁棒性：尝试全名匹配，不成功则尝试简称
      data = await clcdApi.getPrefectureDataByName(region.name);
      if (!data || data.length === 0) {
        data = await clcdApi.getPrefectureDataByName(searchName);
      }
    } else if (region.level === 'county') {
      data = await clcdApi.getCountyDataByName(region.name);
      if (!data || data.length === 0) {
        data = await clcdApi.getCountyDataByName(searchName);
      }
    }
    
    landUseData = Array.isArray(data) ? data : [];
    console.log(`[RegionalStructureControl] Loaded ${landUseData.length} records for ${region.name}`);
  } catch (e) {
    console.error('Error loading land use data:', e);
    landUseData = [];
  }
}

function getRegionSeriesData(regionName, year) {
  if (!landUseData || landUseData.length === 0) return [];
  
  // 关键修正：从全量历史数据中动态寻找当前选中年份的记录
  const record = landUseData.find(d => Number(d.year) === Number(year));
  
  // 如果当前年份没数据，优雅降级，不要崩溃
  if (!record) {
    console.warn(`[RegionalStructureControl] No data found for year ${year} in ${regionName}`);
    return [];
  }

  const typeMapping = {
    cropland: 'cropland', 
    forest: 'forest', 
    shrub: 'shrub',
    grassland: 'grassland', 
    water: 'water', 
    wetland: 'wetland',
    impervious: 'impervious', 
    barren: 'barren', 
    snow_ice: 'snow_ice'
  };

  const types = ['forest', 'snow_ice', 'cropland', 'wetland', 'grassland', 'impervious', 'shrub', 'barren', 'water'];
  
  const totalValue = types.reduce((sum, t) => sum + (Number(record[typeMapping[t]]) || 0), 0);
  if (totalValue === 0) return [];

  return types.map((type, index) => {
    const dbKey = typeMapping[type];
    const rawVal = Number(record[dbKey]) || 0;
    const realValueKm2 = rawVal / 1000000;
    const rawPercent = rawVal / totalValue * 100;
    // 关键修复：对于极小但不为0的占比，使用 < 0.01% 而非 0.00%
    const realPercent = rawPercent > 0 && rawPercent < 0.01 ? '< 0.01' : rawPercent.toFixed(2);
    
    // 深度视觉优化：采用对数缩放 (Logarithmic Scaling) 替代 幂函数缩放
    // 这能极大地拉开 0.1% 到 1.0% 之间微小占比的相对差距，同时适度压缩 20% 以上巨大占比的视觉霸权
    // 计算公式：log10(百分比 * 10 + 1) * 系数 + 偏移量
    const visualValue = Number(realPercent) >= 0.01 
      ? (Math.log10(Number(realPercent) * 10 + 1) * 12) + 2 
      : 0;
    
    return {
      name: landUseNames[type],
      value: visualValue,
      realValue: realValueKm2,
      realPercent: realPercent,
      itemStyle: { 
        color: landUseColors[type], 
        borderColor: '#fff', 
        borderWidth: 2, // 加粗白边，更精致
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.3)'
      }
    };
  });
}

function updatePiePositions() {
  if (!chartInstance.value || !regionsData.length) return;

  const geoCoordSys = chartInstance.value.getModel().getComponent('geo', 0).coordinateSystem;
  const zoom = geoCoordSys.getZoom();
  const width = chartInstance.value.getWidth();
  const height = chartInstance.value.getHeight();
  const minDim = Math.min(width, height);
  
  // 适当大幅提升饼图占比，营造大气磅礴的视觉效果
  // 省级约 40%，地级约 38%，县级约 35%
  const ratios = { province: 0.40, prefecture: 0.38, county: 0.35 };
  const ratio = ratios[selectedRegion.value.level] || 0.35;
  const adaptiveRadius = minDim * ratio * zoom;

  chartInstance.value.setOption({
    series: [{
      // 采用中空环形结构，提升高级感
      radius: [adaptiveRadius * 0.25, adaptiveRadius],
      emphasis: {
        label: {
          fontSize: Math.max(14, 20 * zoom)
        }
      }
    }]
  });
}

async function initChart() {
  if (!chartContainer.value) return;
  isLoading.value = true;

  try {
    // 确保地级市列表已加载
    if (prefectureList.length === 0) {
      const resp = await fetch('/data/yunnan_cities_boundary.geo.json');
      const data = await resp.json();
      prefectureList = data.features.map(f => ({
        name: f.properties.name,
        code: f.properties.adcode || f.Adcode
      }));
    }

    // 先加载数据
    await Promise.all([
      loadGeoJSON(selectedRegion.value),
      loadLandUseData(selectedRegion.value)
    ]);

    const mapName = `map_single_${selectedRegion.value.name}_${selectedRegion.value.level}`;
    if (!echarts.getMap(mapName)) {
      echarts.registerMap(mapName, geoJSON);
    }

    if (chartInstance.value) chartInstance.value.dispose();
    
    // 关键修复：确保容器在初始化前已有宽高，解决 Dom has no width or height 警告
    if (chartContainer.value.offsetWidth === 0 || chartContainer.value.offsetHeight === 0) {
      // 如果还没准备好，等待一个小延迟再重试一次
      console.warn('[RegionalStructureControl] Chart container has no size, retrying...');
      setTimeout(() => initChart(), 100);
      return;
    }
    
    chartInstance.value = echarts.init(chartContainer.value);

    const option = getChartOption(mapName);
    chartInstance.value.setOption(option);
    
    // 只有玫瑰图（快照模式）需要处理地理居中与饼图对齐
    if (currentView.value === 'rose') {
      chartInstance.value.setOption({
          geo: {
              zoom: 1.0,
              layoutCenter: ['50%', '50%'],
              layoutSize: '90%'
          }
      });
      updatePiePositions();
      chartInstance.value.on('georoam', updatePiePositions);
    }
  } catch (e) {
    console.error('Init chart failed:', e);
  } finally {
    isLoading.value = false;
  }
}

function getChartOption(mapName) {
  if (currentView.value === 'kline') {
    return getKlineOption(mapName);
  }
  return getRoseOption(mapName);
}

// 模式 A：南丁格尔玫瑰图
function getRoseOption(mapName) {
  const pieSeries = regionsData.map(reg => {
    const data = getRegionSeriesData(reg.name, currentYear.value);
    
    return {
      type: 'pie',
      coordinateSystem: 'geo',
      name: reg.name,
      center: reg.geoCenter,
      radius: [15, 80],
      roseType: 'area',
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 1.5
      },
      data: data,
      label: {
        show: true,
        position: 'outside',
        color: '#d1e5ff', 
        fontSize: 13,
        fontWeight: 'bold',
        formatter: (params) => {
          const p = params.data.realPercent;
          const suffix = p.includes('<') ? '%' : '%'; // 保持一致
          return `${params.name}: ${p}${suffix}`;
        },
        alignTo: 'labelLine',
        margin: 50
      },
      labelLine: {
        show: true,
        length: 60,  // 缩短第一段，防止飘太远
        length2: 40, // 缩短第二段
        lineStyle: { 
          color: 'rgba(165, 204, 255, 0.6)', 
          width: 1.5, 
          type: 'solid' 
        },
        smooth: 0.2
      },
      zlevel: 11,
      animationDuration: 1200
    };
  });

  return {
    backgroundColor: 'transparent',
    tooltip: {
      show: true,
      trigger: 'item',
      backgroundColor: 'rgba(30, 41, 59, 0.9)',
      padding: [10, 16],
      borderRadius: 8,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      borderWidth: 1,
      textStyle: { color: '#ffffff' },
      formatter: params => {
        if (params.componentType === 'geo') return params.name;
        if (params.seriesType === 'pie') {
          const d = params.data;
          const areaStr = d.realValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km²';
          return `<div style="font-weight: bold; margin-bottom: 4px;">${params.name}</div>
                  <div style="font-size: 11px; opacity: 0.8;">面积: ${areaStr}</div>
                  <div style="font-size: 11px; color: #facc15;">占比: ${d.realPercent}%</div>`;
        }
        return null;
      }
    },
    legend: {
      data: Object.values(landUseNames),
      orient: 'horizontal',
      bottom: '1%',
      left: 'center',
      textStyle: { color: '#fff', fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10
    },
    geo: {
      map: mapName,
      roam: true,
      scaleLimit: { min: 0.8, max: 15 },
      aspectScale: 1.0,
      layoutCenter: ['50%', '50%'],
      layoutSize: '95%',
      label: { show: false },
      itemStyle: {
        areaColor: '#ffffff',
        borderColor: 'rgba(231, 232, 234, 1)',
        borderWidth: 1.5
      },
      emphasis: {
        itemStyle: { areaColor: '#fef08a' }
      }
    },
    series: pieSeries
  };
}

// getKlineOption 已被移除并重构至 RegionalKlineChart.vue

function handleRegionChange() {
  // 选人逻辑已通过 computed setter 同步至 globalStore
  initChart();
}

function toggleModal() {
  if (globalStore.activePanel === panelName) {
    globalStore.setActivePanel(null);
  } else {
    globalStore.setActivePanel(panelName);
    nextTick(() => initChart());
  }
}

function closeModal() {
  globalStore.setActivePanel(null);
}

function handleResize() {
  if (chartInstance.value) {
    chartInstance.value.resize();
    if (currentView.value === 'rose') updatePiePositions();
  }
}

function switchView(viewId) {
  // 此功能已废弃，保留占位防止报错
  currentView.value = 'rose';
}

watch(() => globalStore.scope, async (newScope) => {
  if (isVisible.value) {
    initChart();
  }
}, { deep: true });

watch(currentYear, async () => {
  if (isVisible.value) {
    isLoading.value = true;
    try {
      await loadLandUseData(selectedRegion.value);
      if (chartInstance.value) {
        const option = getChartOption(chartInstance.value.getOption().geo[0].map);
        chartInstance.value.setOption(option, true); // 关键修复：使用 notMerge 彻底清理旧标注，杜绝重叠残影
        updatePiePositions();
      }
    } finally {
      isLoading.value = false;
    }
  }
});

onMounted(async () => {
  window.addEventListener('resize', handleResize);
  
  // 初始化全局及局部层级列表
  try {
    const hier = await regionApi.getRegionHierarchy();
    hierarchyList.value = hier;
  } catch (e) {
    console.error('Failed to fetch hierarchy:', e);
  }

  // 预取可用年份
  try {
    const years = await clcdApi.getAvailableYears();
    if (years && Array.isArray(years) && years.length > 0) {
      const sortedYears = years.map(Number).sort((a, b) => a - b);
      localAvailableYears.value = sortedYears;
      // 同时更新全局 Store，确保全站年份清理同步
      globalStore.setYearsAll(sortedYears);
      
      if (!sortedYears.includes(Number(currentYear.value))) {
        currentYear.value = sortedYears[0];
      }
    }
  } catch (e) {
    console.error('Failed to fetch years:', e);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (chartInstance.value) chartInstance.value.dispose();
  if (flashInterval) clearInterval(flashInterval);
});
</script>

<style scoped>
.regional-structure-control {
  position: relative;
}

.control-btn {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  border: 1px solid rgba(0, 245, 255, 0.45);
  background: rgba(40, 70, 120, 0.45);
  backdrop-filter: blur(12px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 2;
  padding: 0;
  overflow: hidden;
  color: #a5ccff;
}

.control-btn:hover {
  background: rgba(30, 58, 138, 0.6);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-2px);
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.control-btn.active {
  background: #3B76E1 !important;
  border-color: #3B76E1;
  color: #ffffff;
  box-shadow: 0 4px 10px rgba(59, 118, 225, 0.3);
}

.icon-img {
  width: 28px;
  height: 28px;
  object-fit: contain;
  filter: brightness(0) invert(1);
  transition: all 0.3s ease;
}

.control-btn:hover .icon-img {
  opacity: 1;
  transform: scale(1.05);
}

.btn-label {
  position: absolute;
  bottom: 4px;
  right: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 800;
  pointer-events: none;
  letter-spacing: 0.5px;
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 2999;
}

.modal-window {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90vw;
  height: 90vh;
  background: rgba(7, 16, 36, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(24px);
  z-index: 3000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 12px 30px;
  background: rgba(30, 58, 138, 0.3);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: relative; /* 重要：为 absolute 标题提供参照 */
}

.modal-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  white-space: nowrap;
  pointer-events: auto;
}

.title-text {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 2px;
  text-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
}

.year-nav-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a5ccff;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.3s;
}

.year-nav-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
  color: #fff;
  transform: scale(1.1);
}

.close-btn {
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 24px;
  cursor: pointer;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.close-btn:hover {
  background: rgba(245, 108, 108, 0.2);
  color: #fff;
  transform: rotate(90deg) scale(1.1);
}

.close-btn:active {
  transform: rotate(90deg) scale(0.95);
}

.year-nav-btn:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}


.header-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  justify-content: flex-end;
}

.view-switcher-container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

/* 视图切换按钮组 */
.view-switcher {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  padding: 3px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.view-switcher.sub-switcher {
  scale: 0.9;
  transform-origin: left;
  background: rgba(59, 130, 246, 0.05);
}

.switch-btn {
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.switch-btn.mini {
  padding: 3px 8px;
  font-size: 10px;
}

.switch-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.switch-btn.active {
  color: #fff;
  background: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.header-placeholder { display: none; }

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 24px;
  cursor: pointer;
  padding: 10px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #fff;
  transform: scale(1.1);
}

.modal-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  min-height: 0; /* 修正 flex 处理 */
}

.chart-container-wrapper {
  flex: 1;
  position: relative;
  background: radial-gradient(circle at center, rgba(30, 58, 138, 0.1) 0%, transparent 70%);
}

.chart-container {
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
  color: #3b82f6;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* 动画 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-fade-enter-active { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.slide-fade-leave-active { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
.slide-fade-enter-from, .slide-fade-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
</style>
