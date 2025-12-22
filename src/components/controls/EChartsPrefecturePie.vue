<template>
  <div class="echarts-prefecture-pie">
    <button @click="toggleChart" class="control-btn" :class="{ active: isVisible }" title="ECharts 地级市土地利用结构">
      <img :src="iconUrl" alt="图标" class="icon-img" />
    </button>

    <transition name="fade">
      <div v-if="isVisible" class="modal-backdrop" @click="toggleChart"></div>
    </transition>

    <transition name="slide-fade">
      <div v-if="isVisible" class="modal-window" @click.stop>
        <div class="modal-header">
          <span class="modal-title">{{ props.year }}年 - 地级市土地利用结构</span>
          <button class="close-btn" @click.stop="toggleChart">✕</button>
        </div>
        <div ref="chartContainer" class="chart-container"></div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onUnmounted, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import { centroid } from '@turf/turf';
import iconUrl from '../../assets/prefecture_pie_icon.png';

const props = defineProps({
  year: { type: Number, default: 1985 }
});

const isVisible = ref(false);
const chartContainer = ref(null);
let chartInstance = null;
let citiesGeoJSON = null;
let citiesData = null;
let landUseData = null;

const cityLayout = {
  '昆明市': { name: '昆明' },
  '曲靖市': { name: '曲靖' },
  '玉溪市': { name: '玉溪' },
  '保山市': { name: '保山' },
  '昭通市': { name: '昭通' },
  '丽江市': { name: '丽江' },
  '普洱市': { name: '普洱' },
  '临沧市': { name: '临沧' },
  '楚雄彝族自治州': { name: '楚雄' },
  '红河哈尼族彝族自治州': { name: '红河' },
  '文山壮族苗族自治州': { name: '文山' },
  '西双版纳傣族自治州': { name: '西双版纳' },
  '大理白族自治州': { name: '大理' },
  '德宏傣族景颇族自治州': { name: '德宏' },
  '怒江傈僳族自治州': { name: '怒江' },
  '迪庆藏族自治州': { name: '迪庆' }
};

const landUseColors = {
  cropland: '#FAE39C',
  forest: '#446F33',
  shrubland: '#33A02C',
  grassland: '#ABD37B',
  water: '#1E69B4',
  wetland: '#2899E8',
  impervious: '#E24290',
  bareland: '#CFBDA3',
  tundra: '#A6CEE3'
};

const landUseNames = {
  cropland: '耕地',
  forest: '林地',
  shrubland: '灌木地',
  grassland: '草地',
  water: '水体',
  wetland: '湿地',
  impervious: '建设用地',
  bareland: '裸地',
  tundra: '冻土'
};

async function loadCitiesData() {
  if (citiesGeoJSON) return;
  const resp = await fetch('/data/yunnan_cities_boundary.geo.json');
  citiesGeoJSON = await resp.json();
  citiesData = citiesGeoJSON.features.map(f => {
    const name = f.properties.name;
    const config = cityLayout[name] || {};
    const centerPoint = centroid(f);
    const geometricCenter = centerPoint.geometry.coordinates;

    return {
      name: name,
      displayName: config.name || name,
      geoCenter: geometricCenter
    };
  });
}

async function loadLandUseData() {
  if (landUseData) return;
  const resp = await fetch('/data/clcd_prefecture.json');
  landUseData = await resp.json();
}

function getCityLandUse(cityName, year) {
  if (!landUseData) return [];
  const record = landUseData.find(d => {
    const regionName = d.region_name || '';
    return regionName.includes(cityName) && d.year === year;
  });
  if (!record) return [];

  const types = ['cropland', 'forest', 'shrubland', 'grassland', 'water', 'wetland', 'impervious', 'bareland', 'tundra'];
  return types
    .map(type => ({
      name: landUseNames[type],
      value: record[type] || 0,
      itemStyle: { color: landUseColors[type] }
    }))
    .filter(item => item.value > 0);
}

// 更新饼图位置和大小 - 支持缩放
function updatePiePositions() {
  if (!chartInstance || !citiesData) return;

  const geoCoordSys = chartInstance.getModel().getComponent('geo', 0).coordinateSystem;
  const zoom = geoCoordSys.getZoom();
  const baseRadius = 40;
  const scaledRadius = baseRadius * zoom;

  const seriesUpdates = citiesData.map((city) => {
    const pixelPoint = chartInstance.convertToPixel('geo', city.geoCenter);
    if (!pixelPoint) {
      return {};
    }
    return {
      center: pixelPoint,
      radius: [0, scaledRadius],
      emphasis: {
        label: {
          fontSize: Math.max(14, 14 * zoom) // 字体随缩放大小变化，最小14px
        }
      }
    };
  });

  chartInstance.setOption({
    series: seriesUpdates
  });
}

async function initChart() {
  if (!chartContainer.value) return;

  await Promise.all([
    loadCitiesData(),
    loadLandUseData()
  ]);

  if (!echarts.getMap('yunnan_cities')) {
    echarts.registerMap('yunnan_cities', citiesGeoJSON);
  }

  chartInstance = echarts.init(chartContainer.value);
  const baseOption = getBaseChartOption(props.year);
  chartInstance.setOption(baseOption);
  updatePiePositions();

  chartInstance.on('georoam', () => {
    updatePiePositions();
  });

  chartInstance.on('mouseover', (params) => {
    if (params.seriesType === 'pie') {
      const cityName = params.seriesName;
      const cityIndex = citiesData.findIndex(c => c.name === cityName);

      if (cityIndex !== -1) {
        const hoverData = new Array(citiesData.length).fill(null);
        hoverData[cityIndex] = {
          name: cityName,
          value: citiesData[cityIndex].geoCenter,
          label: {
            show: true,
            formatter: `{a|${params.percent.toFixed(1)}%}`,
            rich: {
              a: {
                color: '#fff',
                fontSize: 14,
                fontWeight: 'bold',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: [4, 8],
                borderRadius: 4
              }
            }
          }
        };

        chartInstance.setOption({
          series: [
            ...new Array(citiesData.length).fill({}),
            {
              id: 'hoverLabel',
              data: hoverData
            }
          ]
        });
      }
    }
  });

  chartInstance.on('mouseout', (params) => {
    if (params.seriesType === 'pie') {
      chartInstance.setOption({
        series: [
          ...new Array(citiesData.length).fill({}),
          {
            id: 'hoverLabel',
            data: []
          }
        ]
      });
    }
  });

  window.addEventListener('resize', handleResize);
}

function getBaseChartOption(year) {
  const pieSeries = citiesData.map(city => ({
    type: 'pie',
    name: city.name,
    center: [0, 0],
    radius: [0, 40],
    data: getCityLandUse(city.name, year),
    label: { show: false },
    emphasis: {
      label: {
        show: true,
        position: 'inside',
        formatter: params => {
          return `${params.seriesName}\n${params.value.toFixed(0)} km²\n${params.percent.toFixed(1)}%`;
        },
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
        textBorderColor: '#000',
        textBorderWidth: 1
      },
      itemStyle: {
        shadowBlur: 10,
        shadowOffsetX: 0,
        shadowColor: 'rgba(0, 0, 0, 0.5)'
      }
    },
    labelLine: { show: false },
    zlevel: 2,
    animation: false
  }));

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      borderColor: '#999',
      borderWidth: 1,
      backgroundColor: 'rgba(50, 50, 50, 0.9)',
      textStyle: { color: '#fff' },
      formatter: params => {
        if (params.seriesType === 'pie') {
          return `
            <div style="padding: 8px;">
              <strong style="font-size: 14px;">${params.seriesName}</strong><br/>
              <span style="color: ${params.color};">●</span> ${params.name}: 
              <strong>${params.value.toFixed(2)}</strong> km²<br/>
              占比: <strong>${params.percent.toFixed(1)}%</strong>
            </div>
          `;
        }
        return '';
      }
    },
    legend: {
      data: Object.values(landUseNames),
      orient: 'horizontal',
      bottom: '0%', // 继续下移图例
      left: 'center',
      textStyle: {
        color: '#fff',
        fontSize: 12
      },
      itemWidth: 16,
      itemHeight: 16
    },
    geo: {
      map: 'yunnan_cities',
      roam: true,
      scaleLimit: { min: 0.8, max: 3 },
      aspectScale: 1.0,
      layoutCenter: ['50%', '50%'],
      layoutSize: '100%',
      itemStyle: {
        areaColor: '#e7e8ea',
        borderColor: '#fff',
        borderWidth: 1
      },
      emphasis: {
        label: { show: false },
        itemStyle: {
          areaColor: '#d1d5db',
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.3)'
        }
      },
      zlevel: 0
    },
    series: [
      ...pieSeries,
      {
        id: 'hoverLabel',
        type: 'scatter',
        coordinateSystem: 'geo',
        geoIndex: 0,
        data: [],
        symbolSize: 0,
        label: {
          show: true,
          position: 'bottom',
          offset: [0, 20],
          color: '#fff',
          fontSize: 14,
          fontWeight: 'bold'
        },
        zlevel: 4
      }
    ]
  };
}

function updateYear(newYear) {
  if (!chartInstance || !citiesData || !landUseData) return;
  const baseOption = getBaseChartOption(newYear);
  chartInstance.setOption(baseOption, { notMerge: true });
  updatePiePositions();
}

function handleResize() {
  if (chartInstance) {
    chartInstance.resize();
    updatePiePositions();
  }
}

async function toggleChart() {
  isVisible.value = !isVisible.value;

  if (isVisible.value) {
    await nextTick();
    if (chartInstance) {
      chartInstance.dispose();
      chartInstance = null;
    }
    await initChart();
  } else {
    if (chartInstance) {
      chartInstance.dispose();
      chartInstance = null;
    }
  }
}

watch(() => props.year, (newYear) => {
  if (isVisible.value && chartInstance) {
    updateYear(newYear);
  }
});

onUnmounted(() => {
  if (chartInstance) {
    window.removeEventListener('resize', handleResize);
    chartInstance.dispose();
    chartInstance = null;
  }
});
</script>

<style scoped>
.echarts-prefecture-pie {
  position: relative;
}

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
  z-index: 2;
  padding: 0;
  overflow: hidden;
}

.control-btn:hover {
  background: rgba(52, 71, 130, 0.4);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.control-btn.active {
  background: rgba(156, 201, 255, 0.2);
  border-color: #9cc9ff;
  box-shadow: 0 0 3px rgba(156, 201, 255, 0.2);
}

.icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  z-index: 999;
}

.modal-window {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 50vw;
  height: 90vh;
  background: rgba(42, 61, 110, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  color: white;
  display: flex;
  justify-content: flex-end;
  /* 按钮靠右 */
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  position: relative;
  /* 为标题绝对定位做参照 */
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  text-align: center;
  pointer-events: none;
  /* 防止遮挡点击 */
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 20px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: rotate(90deg);
}

.chart-container {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translate(-50%, -45%);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -48%);
}
</style>
