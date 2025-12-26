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

    <!-- 底图选择器 - 左上角 -->
    <div class="basemap-selector-container">
      <BaseMapSelector @change="handleBaseMapChange" />
    </div>

    <!-- 底部控制按钮组 - 复位视图、测距、测面积、地级市饼图、变化趋势图 -->
    <div class="bottom-controls-container">
      <ViewResetControl />
      <DistanceMeasureButton />
      <AreaMeasureButton />
      <EChartsPrefecturePie :year="selectedYear" />
      <EChartsCountyPie :year="selectedYear" />
      <LandUseTrendControl :seriesData="cachedClcdData" />
      <RegionalTrendControl />
    </div>

    <!-- 测量结果面板集成到按钮组件 -->

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
import BaseMapSelector from './controls/BaseMapSelector.vue';
import LandUsePieChart from './charts/LandUsePieChart.vue';
import DistanceMeasureButton from './controls/DistanceMeasureButton.vue';
import AreaMeasureButton from './controls/AreaMeasureButton.vue';
import EChartsPrefecturePie from './controls/EChartsPrefecturePie.vue';
import EChartsCountyPie from './controls/EChartsCountyPie.vue';
import LandUseTrendControl from './controls/LandUseTrendControl.vue';
import RegionalTrendControl from './controls/RegionalTrendControl.vue';
import { useMapStore } from '../stores/map.ts';

const mapStore = useMapStore();

let viewer = null;
let clcdLayer = null; // 用于存储当前 CLCD 图层的引用
let baseMapLayer = null; // 用于存储当前底图图层
const cachedClcdData = ref([]); // 缓存 CLCD 数据，避免重复加载

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

// 测量工具切换逻辑已移动到按钮组件内部

// 监听年份变化，自动更新 CLCD 图层和图表数据
watch(selectedYear, (newYear) => {
  if (newYear && viewer) {
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
      shouldAnimate: true,
      contextOptions: {
        webgl: {
          alpha: true,
          depth: true,
          stencil: true,
          antialias: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
          failIfMajorPerformanceCaveat: false
        },
        allowTextureFilterAnisotropic: true
      }
    });

    // 开启抗锯齿
    viewer.scene.postProcessStages.fxaa.enabled = true;
    // 开启高动态范围渲染
    viewer.scene.highDynamicRange = true;
    // 设置分辨率缩放因子，提高清晰度
    viewer.resolutionScale = window.devicePixelRatio || 1.0;

    viewer.cesiumWidget.creditContainer.style.display = "none";

    // 禁用倾斜控制，保持垂直视角
    viewer.scene.screenSpaceCameraController.enableTilt = false;
    // 添加默认底图（天地图影像）
    loadBaseMap('imagery');

    // 加载云南省边界
    Cesium.GeoJsonDataSource.load('/data/yunnan_boundary.geo.json', {
      stroke: Cesium.Color.fromCssColorString('#00E5FF'), // 青色
      fill: Cesium.Color.TRANSPARENT,
      strokeWidth: 10, // 加粗
      markerSize: 0,
      clampToGround: true
    }).then(function (dataSource) {
      viewer.dataSources.add(dataSource);
      const entities = dataSource.entities.values;

      // 遍历所有实体，只保留云南省（code: 530000 或 name: 云南）
      for (let i = entities.length - 1; i >= 0; i--) {
        const entity = entities[i];
        const name = entity.properties.name ? entity.properties.name.getValue() : '';
        const code = entity.properties.code ? entity.properties.code.getValue() : '';

        if (name.includes('云南') || code == '530000') {
          // 云南省，设置样式
          if (entity.polyline) {
            entity.polyline.width = 10; // 加粗
            // 使用轮廓材质效果
            entity.polyline.material = new Cesium.PolylineOutlineMaterialProperty({
              color: Cesium.Color.fromCssColorString('#00E5FF'), // 内部青色
              outlineColor: Cesium.Color.fromCssColorString('#00838F'), // 外部深青色描边
              outlineWidth: 6 // 加粗描边
            });
            entity.polyline.clampToGround = true;
          }
          if (entity.polygon) {
            entity.polygon.fill = false;
            entity.polygon.outline = true;
            entity.polygon.outlineColor = Cesium.Color.fromCssColorString('#00E5FF');
            entity.polygon.outlineWidth = 6; // 加粗
          }
        } else {
          // 移除不是云南省区域
          dataSource.entities.remove(entity);
        }
      }
    }).catch(function (error) {
      console.error('加载云南边界数据失败:', error);
    });

    // 设置初始视角到云南省中心，垂直俯视视角
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(101.8, 25.2, 1900000),
      orientation: {
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0
      }
    });

    // 将 viewer 挂载到 window 对象上，供其他组件使用
    window.cesiumViewer = viewer;

    // 将 viewer 注册到 map store，以便其他组件可以使用
    mapStore.setViewer(viewer);

    // 加载默认年份（1985）的 CLCD 图层
    loadCLCDLayer(selectedYear.value);
    loadYearData(selectedYear.value);

  } catch (e) {
    console.error('Cesium initialization error:', e);
  }
});

// 加载当年数据（用于图表）- 带缓存优化
async function loadYearData(year) {
  try {
    // 只在第一次加载数据，之后使用缓存
    if (cachedClcdData.value.length === 0) {
      // Use the new API endpoint
      const response = await fetch('http://localhost:3000/api/clcd/province');
      if (response.ok) {
        cachedClcdData.value = await response.json();
        console.log('CLCD 数据已加载并缓存 (1985-2023)');
      } else {
        console.error('加载 CLCD 数据失败');
        return;
      }
    }

    // 从缓存中按需查询指定年份
    if (cachedClcdData.value.length > 0) {
      const yearData = cachedClcdData.value.find(item => item.year === year);

      if (yearData) {
        // 映射为前端需要的字段名（英文 → 中文）
        // Note: The API returns lowercase keys like 'cropland', 'forest' which matches here
        currentYearData.value = {
          year: yearData.year,
          耕地: yearData.cropland,
          林地: yearData.forest,
          灌木: yearData.shrub, // Database uses 'shrub', check if mapping needed. JSON used 'shrubland' or 'shrub'?
          // Looking at previous JSON content, it used 'shrubland'.
          // Looking at database schema screenshot, it uses 'shrub'.
          // I should check what the API returns. The API returns what's in the DB.
          // DB has 'shrub'.
          // Wait, let me check the implementation plan or previous file content.
          // In server/index.js pivot logic: yearMap[row.year][row.land_use_type] = Number(row.area);
          // So the keys will be whatever is in `land_use_type` column.
          // Screenshot shows 'shrub'.
          // Front page expects '灌木'.
          // So I should map 'shrub' to '灌木'.

          // Let's be safe and check for both or just use 'shrub' if that's what DB has.
          // Actually, let's look at the `CLCD_CLASS_MAP` in server/index.js (though I didn't use it in the new endpoint).
          // The new endpoint returns raw strings from DB.
          // DB Screenshot shows: cropland, forest, shrub, grassland, water, snow_ice, barren, impervious, wetland.

          // So:
          // cropland -> 耕地
          // forest -> 林地
          // shrub -> 灌木
          // grassland -> 草地
          // water -> 水域
          // snow_ice -> 冰雪
          // barren -> 裸地
          // impervious -> 建设用地
          // wetland -> 湿地

          // Previous JSON keys might have been slightly different (e.g. shrubland vs shrub).
          // I will use the DB keys.

          耕地: yearData.cropland,
          林地: yearData.forest,
          灌木: yearData.shrub,
          草地: yearData.grassland,
          水域: yearData.water,
          冰雪: yearData.snow_ice, // DB uses snow_ice
          裸地: yearData.barren,
          建设用地: yearData.impervious,
          湿地: yearData.wetland
        };
      } else {
        console.warn(`未找到 ${year} 年的数据`);
      }
    }
  } catch (e) {
    console.error('加载 CLCD 数据失败:', e);
  }
}

// 加载底图
function loadBaseMap(mapType) {
  if (!viewer) return;

  // 移除现有底图
  if (baseMapLayer) {
    viewer.imageryLayers.remove(baseMapLayer);
    baseMapLayer = null;
  }

  const token = 'ab70e90828db5b27aa040f2cb879c7f1';
  let layerName, url;

  switch (mapType) {
    case 'imagery':
      // 天地图影像
      layerName = 'img';
      url = `http://t0.tianditu.gov.cn/img_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${layerName}&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`;
      break;
    case 'vector':
      // 天地图矢量
      layerName = 'vec';
      url = `http://t0.tianditu.gov.cn/vec_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${layerName}&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`;
      break;
    case 'terrain':
      // 天地图地形
      layerName = 'ter';
      url = `http://t0.tianditu.gov.cn/ter_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${layerName}&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`;
      break;
    default:
      return;
  }

  try {
    const imageryProvider = new Cesium.WebMapTileServiceImageryProvider({
      url: url,
      layer: layerName,
      style: 'default',
      format: 'image/jpeg',
      tileMatrixSetID: 'w',
      maximumLevel: 18
    });

    // 在索引 0 位置添加底图，确保底图在最底层
    baseMapLayer = viewer.imageryLayers.addImageryProvider(imageryProvider, 0);
  } catch (e) {
    console.error('加载底图失败:', e);
  }
}

// 处理底图切换
function handleBaseMapChange(mapType) {
  loadBaseMap(mapType);
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
body,
html {
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
  background-image: url('/assets/images/backgrounds/front_bg.png');
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
  background-image: url('/assets/images/backgrounds/mask.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-position: center center;
}

.year-selector-container {
  position: fixed;
  top: 40px;
  /* 距离顶部 20px */
  left: 20px;
  /* 距离左侧 20px */
  z-index: 200;
}

/* 复位视图、测距、测面积按钮 */
.bottom-controls-container {
  position: fixed;
  bottom: 30px;
  /* 距离底部的距离 */
  left: 20px;
  /* 距离左侧的距离 */
  z-index: 200;
  display: flex;
  flex-direction: column;
  /* 垂直排列 */
  align-items: center;
  gap: 10px;
  /* 按钮之间的间距 */
  min-height: 160px;
  /* 确保有足够空间显示弹出窗口 */
}

.basemap-selector-container {
  position: fixed;
  top: 40px;
  /* 距离顶部 20px */
  left: 250px;
  /* 距离左侧 20px */
  z-index: 200;
}

/* 右侧图表面板区域 */
.right-panels {
  position: fixed;
  right: 20px;
  top: 20px;
  width: 450px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
  z-index: 150;
}

/* 面板卡片通用样式 */
.panel-card {
  background: rgba(42, 61, 110, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  overflow: hidden;
}

/* 面板标题 */
.panel-title {
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 600;
  color: #9cc9ff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(42, 61, 110, 0.3);
}

/* 图例面板样式 */
.legend-panel {
  padding-bottom: 8px;
}

.legend-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 8px;
  /* 间距 */
  padding: 8px 12px;
  /* 内边距 */
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  /* 间距 */
}

.legend-color {
  width: 12px;
  /* 减小色块 */
  height: 12px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.legend-name {
  font-size: 12px;
  /* 字体 */
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

/* 土地利用结构图按钮样式 */
.control-btn {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(42, 61, 110, 0.2);
  backdrop-filter: blur(8px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.control-btn:hover {
  background: rgba(52, 71, 130, 0.4);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.control-btn.active {
  background: rgba(156, 201, 255, 0.2);
  border-color: #9cc9ff;
  box-shadow: 0 0 0 3px rgba(156, 201, 255, 0.2);
}

.control-btn .icon {
  font-size: 24px;
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
