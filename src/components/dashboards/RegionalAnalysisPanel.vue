<!--
  @component RegionalAnalysisPanel
  @description 区域对比分析面板，支持不同行政单元（县级）的土地利用指标对比展示与地图着色渲染
  @props 无
  @emits 无
  @dependencies Cesium, clcdApi, AnalysisLegend, useMapStore
-->
<template>
  <div class="regional-analysis-panel">
    <!-- 入口按钮 -->
    <button @click="openPanel" class="control-btn" :class="{ active: isVisible }" title="区域检测分析">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <span class="btn-label">区域检测</span>
    </button>

    <Teleport to="body">
      <transition name="slide-down">
        <div v-if="isVisible" class="analysis-header-panel">
          <button class="back-btn" @click="closePanel" title="返回工作台">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            返回
          </button>

          <div class="controls">
            <div class="control-group">
              <label>空间单元</label>
              <div class="btn-group">
                <button 
                  :class="{ active: spatialUnit === 'county' }" 
                  @click="spatialUnit = 'county'"
                >县级</button>
                <button 
                  :class="{ active: spatialUnit === 'grid' }" 
                  @click="spatialUnit = 'grid'"
                  disabled
                  title="格网数据暂不支持"
                >格网</button>
              </div>
            </div>

            <div class="control-group">
              <label>分析指标</label>
              <select v-model="selectedAttribute">
                <option v-for="attr in attributes" :key="attr.value" :value="attr.value">
                  {{ attr.label }}
                </option>
              </select>
            </div>

            <div class="control-group">
              <label>年份</label>
              <select v-model="selectedYear">
                <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
              </select>
            </div>

            <button class="load-btn" @click="loadAndRender" :disabled="isLoading">
              <span v-if="isLoading" class="spinner-small"></span>
              <span v-else>加载分析</span>
            </button>
          </div>

          <div class="modal-title">区域土地利用检测分析</div>
        </div>
      </transition>

      <transition name="fade">
        <div v-if="isVisible && legendBreaks.length > 0" class="analysis-legend-container">
          <AnalysisLegend 
            :title="currentAttributeLabel" 
            :breaks="legendBreaks" 
            :colors="colorScale"
            :floating="false"
            unit="km²"
          />
        </div>
      </transition>

      <transition name="fade">
        <div v-if="isVisible && isLoading" class="analysis-loading-overlay">
          <div class="spinner"></div>
          <span>正在加载空间数据...</span>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, onUnmounted, inject } from 'vue';
import * as Cesium from 'cesium';
import { clcdApi } from '../../api/index.js';
import AnalysisLegend from '../ui/AnalysisLegend.vue';
import { useMapStore } from '../../stores/map.ts';
import { useGlobalStore } from '../../stores/global';
import { UI_CONFIG } from '../../config/index.js';
import { applyThickPolygonOutlineForEntity } from '../../utils/cesiumUtils.js';

const globalStore = useGlobalStore();
const panelName = 'regionalAnalysis';

const mapStore = useMapStore();

const isVisible = computed(() => globalStore.activePanel === panelName);
const isLoading = ref(false);
const spatialUnit = ref('county');
const selectedAttribute = ref('cropland');
const selectedYear = ref(2023);
const availableYears = ref([1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2021, 2022, 2023]);

const dataSource = shallowRef(null);
const legendBreaks = ref([]);

// 保存之前的 CLCD 图层引用，用于恢复
const previousClcdLayer = shallowRef(null);

const colorScale = ['#2ecc71', '#7dcea0', '#f9e79f', '#f5b041', '#e74c3c'];

const attributes = [
  { value: 'cropland', label: '耕地面积 (km²)' },
  { value: 'forest', label: '林地面积 (km²)' },
  { value: 'shrub', label: '灌木面积 (km²)' },
  { value: 'grassland', label: '草地面积 (km²)' },
  { value: 'water', label: '水域面积 (km²)' },
  { value: 'wetland', label: '湿地面积 (km²)' },
  { value: 'impervious', label: '建设用地面积 (km²)' },
  { value: 'barren', label: '裸地面积 (km²)' },
  { value: 'snow_ice', label: '冰雪面积 (km²)' }
];

const currentAttributeLabel = computed(() => {
  const attr = attributes.find(a => a.value === selectedAttribute.value);
  return attr ? attr.label : '';
});

function openPanel() {
  globalStore.setActivePanel(panelName);
  
  // 通知父组件隐藏其他控件
  const viewer = mapStore.viewer;
  if (viewer) {
    // 飞到云南适合分析的视角
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(101.8, 25.2, 600000),
      duration: 1.5
    });
  }
}

function closePanel() {
  globalStore.setActivePanel(null);
  
  // 清理分析数据
  const viewer = mapStore.viewer;
  if (viewer && dataSource.value) {
    viewer.dataSources.remove(dataSource.value);
    dataSource.value = null;
  }
  legendBreaks.value = [];
}

async function loadAndRender() {
  const viewer = mapStore.viewer;
  if (!viewer) {
    console.error('Viewer not available');
    return;
  }
  
  isLoading.value = true;

  try {
    // 移除旧数据源
    if (dataSource.value) {
      viewer.dataSources.remove(dataSource.value);
      dataSource.value = null;
    }

    // 获取空间数据
    const geojson = await clcdApi.getSpatialCountyData(selectedYear.value);
    
    if (!geojson || !geojson.features || geojson.features.length === 0) {
      console.error('No spatial data returned');
      isLoading.value = false;
      return;
    }

    // 计算分级区间
    const values = geojson.features
      .map(f => f.properties[selectedAttribute.value] || 0)
      .filter(v => v > 0);
    
    const breaks = calculateBreaks(values, 5);
    legendBreaks.value = breaks;

    // 加载 GeoJSON，移除 clampToGround 以加速面渲染
    const ds = await Cesium.GeoJsonDataSource.load(geojson, {
      fill: Cesium.Color.TRANSPARENT,
      stroke: Cesium.Color.TRANSPARENT,
      strokeWidth: 0
    });

    // 根据属性值着色
    const entities = ds.entities.values;
    entities.forEach(entity => {
      if (entity.polygon) {
        const value = entity.properties[selectedAttribute.value]?.getValue() || 0;
        const color = getColorForValue(value, breaks);
        entity.polygon.material = color.withAlpha(0.75);
        
        applyThickPolygonOutlineForEntity(entity, Cesium.Color.WHITE.withAlpha(0.6), UI_CONFIG.BOUNDARY_STYLE.countyWidth, Cesium);
      }
    });

    viewer.dataSources.add(ds);
    dataSource.value = ds;

    // 飞到数据范围
    viewer.flyTo(ds, { duration: 1.5 });

  } catch (e) {
    console.error('加载空间数据失败:', e);
  } finally {
    isLoading.value = false;
  }
}

function calculateBreaks(values, numClasses) {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const interval = (max - min) / numClasses;
  
  const breaks = [];
  for (let i = 0; i <= numClasses; i++) {
    breaks.push(min + interval * i);
  }
  return breaks;
}

function getColorForValue(value, breaks) {
  if (breaks.length < 2) return Cesium.Color.GRAY;
  
  for (let i = 0; i < breaks.length - 1; i++) {
    if (value >= breaks[i] && value < breaks[i + 1]) {
      return Cesium.Color.fromCssColorString(colorScale[i]);
    }
  }
  // 最大值
  if (value >= breaks[breaks.length - 2]) {
    return Cesium.Color.fromCssColorString(colorScale[colorScale.length - 1]);
  }
  return Cesium.Color.fromCssColorString(colorScale[0]);
}

// 暴露 isVisible 供父组件使用
defineExpose({ isVisible });

onMounted(async () => {
  try {
    const data = await clcdApi.getAvailableYears();
    if (data && data.length > 0) {
      availableYears.value = data.sort((a, b) => a - b);
      if (!availableYears.value.includes(selectedYear.value)) {
          selectedYear.value = availableYears.value[availableYears.value.length - 1];
      }
    }
  } catch (e) {
    console.error('Failed to sync years in RegionalAnalysisPanel:', e);
  }
});

onUnmounted(() => {
  const viewer = mapStore.viewer;
  if (viewer && dataSource.value) {
    viewer.dataSources.remove(dataSource.value);
    dataSource.value = null;
  }
});
</script>

<style scoped>
.regional-analysis-panel {
  position: relative;
}

.control-btn {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 34, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: #a5ccff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.control-btn.active {
  background: #3B76E1 !important;
  border-color: #3B76E1;
  color: #ffffff;
  box-shadow: 0 4px 10px rgba(59, 118, 225, 0.3);
}

.control-btn:hover {
  background: rgba(30, 58, 138, 0.6);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-2px);
  color: #ffffff;
}

.control-btn .icon {
  width: 24px;
  height: 24px;
}

.btn-label {
  font-size: 10px;
  font-weight: 600;
}

/* 顶部分析控制面板：调亮并增强通透感 */
.analysis-header-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 24px;
  /* 调亮背景 */
  background: linear-gradient(135deg, rgba(25, 50, 100, 0.5) 0%, rgba(35, 75, 130, 0.3) 100%);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  
  /* 解决模糊渲染延迟方案 */
  contain: paint;
  transform: translateZ(1px);
  will-change: transform, opacity;

  border-bottom: 1.5px solid rgba(0, 245, 255, 0.4);
  z-index: 3000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateX(-4px);
}

.back-btn svg {
  width: 18px;
  height: 18px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 20px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-group label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.control-group select {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  min-width: 120px;
}

.control-group select:focus {
  outline: none;
  border-color: #3b82f6;
}

.control-group select option {
  background: #1e3a5f;
  color: #fff;
}

.btn-group {
  display: flex;
  gap: 0;
}

.btn-group button {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-group button:first-child {
  border-radius: 6px 0 0 6px;
}

.btn-group button:last-child {
  border-radius: 0 6px 6px 0;
  border-left: none;
}

.btn-group button.active {
  background: #3B76E1;
  border-color: #3B76E1;
  color: #ffffff;
}

.btn-group button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.load-btn {
  padding: 10px 24px;
  background: #3B76E1;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.load-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.load-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 2px;
  text-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
}

/* 图例容器 */
.analysis-legend-container {
  position: fixed;
  bottom: 30px;
  left: 24px;
  right: auto;
  z-index: 3000;
}

/* 加载状态 */
.analysis-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(13, 25, 48, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: rgba(255, 255, 255, 0.9);
  z-index: 2999;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Transitions */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
