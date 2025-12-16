<template>
  <div id="cesiumContainerWrapper">
    <div class="background-layer"></div>
    <div class="mask-layer"></div>
    <div id="cesiumContainer"></div>
    
    <!-- 年份选择器 - 左上角 -->
    <div class="year-selector-container">
      <YearRangeSelector v-model:selectedYear="selectedYear" :width="200" />
    </div>
    
    <!-- 复位视图控制按钮 - 左上角 -->
    <div class="reset-control-container">
      <ViewResetControl />
    </div>
    
    <!-- 右侧图表面板区域 -->
    <div class="right-panels">
      <!-- CLCD 图例 -->
      <div class="panel-card legend-panel">
        <div class="panel-title">CLCD 图例</div>
        <div class="legend-grid">
          <div v-for="(color, name) in clcdColors" :key="name" class="legend-item">
            <span class="legend-color" :style="{ background: color }"></span>
            <span class="legend-name">{{ legendNames[name] }}</span>
          </div>
        </div>
      </div>
      
      <!-- 当年土地利用结构饼图 -->
      <div class="panel-card chart-panel">
        <LandUsePieChart :year="selectedYear" :seriesData="currentYearData" :compact="true" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import YearRangeSelector from './controls/YearRangeSelector.vue';
import ViewResetControl from './controls/ViewResetControl.vue';
import LandUsePieChart from './charts/LandUsePieChart.vue';
import { useMapStore } from '../stores/map.ts';

const mapStore = useMapStore();

let viewer = null;
let clcdLayer = null; // 用于存储当前 CLCD 图层的引用
const selectedYear = ref(1985); // 当前选择的年份，默认1985
const currentYearData = ref({}); // 当前年份的数据

// CLCD 颜色映射
const clcdColors = {
  Cropland: 'rgb(250,227,156)',
  Forest: 'rgb(68,111,51)',
  Shrub: 'rgb(51,160,44)',
  Grassland: 'rgb(171,211,123)',
  Water: 'rgb(30,105,180)',
  'Snow/Ice': 'rgb(166,206,227)',
  Barren: 'rgb(207,189,163)',
  Impervious: 'rgb(226,66,144)',
  Wetland: 'rgb(40,155,232)'
};

// 图例中文名称映射
const legendNames = {
  Cropland: '耕地',
  Forest: '林地',
  Shrub: '灌木',
  Grassland: '草地',
  Water: '水域',
  'Snow/Ice': '冰雪',
  Barren: '裸地',
  Impervious: '建设用地',
  Wetland: '湿地'
};

// 监听年份变化，自动更新 CLCD 图层和图表数据
watch(selectedYear, (newYear) => {
  if (newYear && viewer) {
    console.log('年份已更改为:', newYear);
    loadCLCDLayer(newYear);
    loadYearData(newYear);
  }
});

onMounted(() => {
  try {
    viewer = new Cesium.Viewer("cesiumContainer", {
      imageryProvider: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      animation: false,
      navigationHelpButton: false,
      infoBox: false,
      fullscreenButton: false,
      shouldAnimate: true
    });
    
    viewer.cesiumWidget.creditContainer.style.display = "none";
    
    // 禁用倾斜控制，保持垂直视角
    viewer.scene.screenSpaceCameraController.enableTilt = false;
    
    // 添加天地图底图
    viewer.imageryLayers.addImageryProvider(
      new Cesium.WebMapTileServiceImageryProvider({
        url: "http://t0.tianditu.gov.cn/img_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=img&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=ab70e90828db5b27aa040f2cb879c7f1",
        layer: "tdtImgBasicLayer",
        style: "default",
        format: "image/jpeg",
        tileMatrixSetID: "w",
        maximumLevel: 18
      })
    );
    
    // 设置初始视角到云南省中心（垂直俯视）
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(101.8, 25.2, 1900000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0
      }
    });
    
    // 将 viewer 注册到 map store，以便其他组件可以使用
    mapStore.setViewer(viewer);
    
    // 加载默认年份（1985）的 CLCD 图层
    loadCLCDLayer(selectedYear.value);
    loadYearData(selectedYear.value);
    
  } catch (e) {
    console.error('Cesium initialization error:', e);
  }
});

// 加载当年数据（用于图表）
async function loadYearData(year) {
  try {
    // 尝试从后端加载数据
    const response = await fetch(`/api/clcd/${year}/summary`);
    if (response.ok) {
      const data = await response.json();
      currentYearData.value = data;
    } else {
      // 使用 Mock 数据
      currentYearData.value = generateMockData(year);
    }
  } catch (e) {
    console.warn('Failed to load year data, using mock data:', e);
    currentYearData.value = generateMockData(year);
  }
}

// 生成 Mock 数据
function generateMockData(year) {
  const yearIndex = year - 1985;
  return {
    year: year,
    耕地: 120000 - yearIndex * 300 + 2000 * Math.sin(yearIndex / 2),
    林地: 150000 + yearIndex * 200,
    灌木: 22000 + 80 * yearIndex,
    草地: 80000 - yearIndex * 150,
    水域: 12000 + 12 * yearIndex,
    冰雪: Math.max(200 - yearIndex * 5, 20),
    裸地: 16000 - 60 * yearIndex,
    建设用地: 9000 + 300 * yearIndex,
    湿地: 9000 + 20 * yearIndex
  };
}

// 加载指定年份的 CLCD WMS 图层
function loadCLCDLayer(year) {
  // 如果已有图层，先移除
  if (clcdLayer && viewer) {
    viewer.imageryLayers.remove(clcdLayer, true);
    clcdLayer = null;
  }
  
  try {
    clcdLayer = viewer.imageryLayers.addImageryProvider(
      new Cesium.WebMapServiceImageryProvider({
        url: 'http://localhost:8080/geoserver/WebGIS/wms',
        layers: `WebGIS:${year}_yunnan_CLCD_raster`,
        parameters: {
          service: 'WMS',
          version: '1.1.0',
          request: 'GetMap',
          format: 'image/png',
          transparent: true
        }
      })
    );
    console.log(`已加载 ${year} 年 CLCD 图层`);
  } catch (e) {
    console.error(`加载 ${year} 年 CLCD 图层失败:`, e);
  }
}
</script>

<style>
/* 全局样式：移除浏览器默认边距 */
body, html {
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}
</style>

<style scoped>
#cesiumContainerWrapper { 
  position: fixed;
  top: 0;
  left: 0;
  margin: 0;
  padding: 0;
  width: 100vw; 
  height: 100vh; 
  overflow: hidden; 
}

#cesiumContainer { 
  width: 100%; 
  height: 100%; 
  position: relative;
  z-index: 10;
}

.background-layer {
  position: fixed;
  top: -2%;
  left: -2%;
  right: -2%;
  bottom: -2%;
  width: 104vw;
  height: 104vh;
  z-index: 100;
  pointer-events: none;
  background-image: url('/images/front_bg.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-position: center center;
}

.mask-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 50;
  pointer-events: none;
  background-image: url('../assets/mask.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-position: center center;
}

.year-selector-container {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 200;
}

.reset-control-container {
  position: fixed;
  top: 80px;
  left: 20px;
  z-index: 200;
}

/* 右侧图表面板区域 */
.right-panels {
  position: fixed;
  right: 20px;
  top: 20px;
  width: 320px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
  z-index: 150;
}

/* 面板卡片通用样式 */
.panel-card {
  background: rgba(42, 61, 110, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  overflow: hidden;
}

/* 面板标题 */
.panel-title {
  padding: 12px 16px;
  font-size: 16px;
  font-weight: 600;
  color: #9cc9ff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(42, 61, 110, 0.95);
}

/* 图例面板样式 */
.legend-panel {
  padding-bottom: 10px;
}

.legend-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  padding: 12px 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.legend-name {
  font-size: 13px;
  color: #ffffff;
}

/* 图表面板 */
.chart-panel {
  min-height: 200px;
}

.trend-panel {
  min-height: 350px;
}

/* 右侧面板滚动条样式 */
.right-panels::-webkit-scrollbar {
  width: 6px;
}

.right-panels::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.right-panels::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.right-panels::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
</style>
