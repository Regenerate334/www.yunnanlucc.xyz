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

    <!-- 底部控制按钮组 - 复位视图、测距、测面积 -->
    <div class="bottom-controls-container">
      <ViewResetControl />
      <DistanceMeasureButton :isActive="activeTool === 'distance'" @toggle="toggleDistanceTool" />
      <AreaMeasureButton :isActive="activeTool === 'area'" @toggle="toggleAreaTool" />
    </div>

    <!-- 测量结果面板 -->
    <MeasurementControl v-if="false" />

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

      <!-- 土地利用趋势图 -->
      <div class="panel-card chart-panel trend-panel">
        <LandUseTrendChart :seriesData="cachedClcdData" />
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
import LandUseTrendChart from './charts/LandUseTrendChart.vue';
import MeasurementControl from './controls/MeasurementControl.vue';
import DistanceMeasureButton from './controls/DistanceMeasureButton.vue';
import AreaMeasureButton from './controls/AreaMeasureButton.vue';
import { useMapStore } from '../stores/map.ts';

const mapStore = useMapStore();

let viewer = null;
let clcdLayer = null; // 用于存储当前 CLCD 图层的引用
let baseMapLayer = null; // 用于存储当前底图图层
const cachedClcdData = ref([]); // 缓存 CLCD 数据，避免重复加载

const selectedYear = ref(1985); // 当前选择的年份，默认1985
const currentYearData = ref({}); // 当前年份的数据
const activeTool = ref(null); // 当前激活的测量工具: 'distance' | 'area' | null

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

// 测量工具切换方法
const toggleDistanceTool = () => {
  if (activeTool.value === 'distance') {
    activeTool.value = null;
  } else {
    activeTool.value = 'distance';
  }
};

const toggleAreaTool = () => {
  if (activeTool.value === 'area') {
    activeTool.value = null;
  } else {
    activeTool.value = 'area';
  }
};

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
      shouldAnimate: true
    });

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

    // 设置初始视角到云南省中心（垂直俯视）
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
    // 只在第一次加载 JSON 文件，之后使用缓存
    if (cachedClcdData.value.length === 0) {
      const response = await fetch('/data/clcd_province.json');
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
        currentYearData.value = {
          year: yearData.year,
          耕地: yearData.cropland,
          林地: yearData.forest,
          灌木: yearData.shrubland,
          草地: yearData.grassland,
          水域: yearData.water,
          冰雪: yearData.tundra,
          裸地: yearData.bareland,
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
  top: 40px;
  /* 距离顶部 20px */
  left: 20px;
  /* 距离左侧 20px */
  z-index: 200;
}

/* 复位视图、测距、测面积按钮 */
.bottom-controls-container {
  position: fixed;
  bottom: 20px;
  /* 距离底部的距离 */
  left: 90px;
  /* 距离左侧的距离 */
  z-index: 200;
  display: flex;
  flex-direction: column;
  /* 垂直排列 */
  align-items: center;
  gap: 10px;
  /* 按钮之间的间距 */
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
  /* 减小字体 */
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
