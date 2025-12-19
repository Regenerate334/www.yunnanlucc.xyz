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
          <span class="modal-title">地级市土地利用结构 - {{ props.year }}年</span>
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

// 城市布局配置：手动调整饼图中心和标签位置
// 标签位置根据地图空白区域灵活调整
const cityLayout = {
  '昆明市': { name: '昆明', labelPosition: 'bottom', labelOffset: [0, 10] },
  '曲靖市': { name: '曲靖', labelPosition: 'right', labelOffset: [10, 0] },
  '玉溪市': { name: '玉溪', labelPosition: 'bottom', labelOffset: [0, 10] },
  '保山市': { name: '保山', labelPosition: 'left', labelOffset: [-10, 0] },
  '昭通市': { name: '昭通', labelPosition: 'top', labelOffset: [0, -10] },
  '丽江市': { name: '丽江', labelPosition: 'top', labelOffset: [0, -10] },
  '普洱市': { name: '普洱', centerOffset: [-0.3, 0.3], labelPosition: 'bottom', labelOffset: [0, 15] },
  '临沧市': { name: '临沧', centerOffset: [-0.3, 0.3], labelPosition: 'left', labelOffset: [-10, 10] },
  '楚雄彝族自治州': { name: '楚雄', labelPosition: 'top', labelOffset: [0, -5] },
  '红河哈尼族彝族自治州': { name: '红河', labelPosition: 'bottom', labelOffset: [0, 10] },
  '文山壮族苗族自治州': { name: '文山', labelPosition: 'right', labelOffset: [10, 10] },
  '西双版纳傣族自治州': { name: '西双版纳', labelPosition: 'bottom', labelOffset: [0, 10] },
  '大理白族自治州': { name: '大理', labelPosition: 'left', labelOffset: [-10, -10] },
  '德宏傣族景颇族自治州': { name: '德宏', labelPosition: 'left', labelOffset: [-10, 0] },
  '怒江傈僳族自治州': { name: '怒江', labelPosition: 'left', labelOffset: [-10, 0] },
  '迪庆藏族自治州': { name: '迪庆', labelPosition: 'top', labelOffset: [0, -10] }
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
    const center = f.properties.center;

    // 应用中心偏移
    let finalCenter = center;
    if (config.centerOffset) {
      finalCenter = [center[0] + config.centerOffset[0], center[1] + config.centerOffset[1]];
    }

    return {
      name: name,
      displayName: config.name || name,
      center: finalCenter,
      labelPosition: config.labelPosition || 'bottom',
      labelOffset: config.labelOffset || [0, 10]
    };
  });
}

async function loadLandUseData() {
  if (landUseData) return;
  const resp = await fetch('/data/clcd_prefecture.json');
  landUseData = await resp.json();
}

function getCityLandUse(cityName, year) {
  if (!landUseData) {
    console.warn('Land use data not loaded');
    return [];
  }

  const record = landUseData.find(d => {
    const regionName = d.region_name || '';
    return regionName.includes(cityName) && d.year === year;
  });

  if (!record) {
    console.warn(`No data found for ${cityName} in ${year}`);
    return [];
  }

  const types = ['cropland', 'forest', 'shrubland', 'grassland', 'water', 'wetland', 'impervious', 'bareland', 'tundra'];
  const result = types
    .map(type => ({
      name: landUseNames[type],
      value: record[type] || 0,
      itemStyle: { color: landUseColors[type] }
    }))
    .filter(item => item.value > 0);

  console.log(`${cityName} ${year}: ${result.length} land use types found`);
  return result;
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

  const option = getChartOption(props.year);
  chartInstance.setOption(option);

  window.addEventListener('resize', handleResize);
}

function getChartOption(year) {
  const pieSeries = citiesData.map(city => ({
    type: 'pie',
    coordinateSystem: 'geo',
    geoIndex: 0,
    name: city.name,
    center: city.center,
    radius: ['0%', '8%'],
    data: getCityLandUse(city.name, year),
    label: { show: false },
    emphasis: {
      label: {
        show: true,
        fontSize: 12,
        fontWeight: 'bold',
        formatter: '{b}\n{d}%',
        position: 'outside' // 确保百分比标签显示在外部
      }
    },
    labelLine: { show: false },
    zlevel: 2,
    animation: true,
    animationDuration: 1000,
    animationEasing: 'cubicOut'
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
      bottom: '5%',
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
      layoutCenter: ['50%', '45%'],
      layoutSize: '90%',
      itemStyle: {
        areaColor: '#e7e8ea',
        borderColor: '#fff',
        borderWidth: 1
      },
      emphasis: {
        label: { show: false },
        itemStyle: {
          areaColor: '#d1d5db', // 鼠标悬浮时的高亮颜色
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.3)'
        }
      },
      zlevel: 0
    },
    series: [
      ...pieSeries,
      {
        type: 'scatter',
        coordinateSystem: 'geo',
        geoIndex: 0,
        data: citiesData.map(city => ({
          name: city.displayName,
          value: city.center,
          label: {
            position: city.labelPosition,
            offset: city.labelOffset
          }
        })),
        symbolSize: 0,
        label: {
          show: true,
          formatter: '{b}',
          fontSize: 12,
          color: '#333',
          fontWeight: 'bold',
          textBorderColor: '#fff',
          textBorderWidth: 2
        },
        zlevel: 3
      }
    ]
  };
}

function updateYear(newYear) {
  console.log(`updateYear called with: ${newYear}`);
  if (!chartInstance) {
    console.error('Chart instance not available');
    return;
  }
  if (!citiesData || !landUseData) {
    console.error('Data not loaded');
    return;
  }

  console.log(`Generating option for year ${newYear}`);
  const option = getChartOption(newYear);
  console.log('Setting new option on chart, series count:', option.series.length);

  chartInstance.setOption(option, { notMerge: true });
  console.log('Chart updated successfully');
}

function handleResize() {
  if (chartInstance) {
    chartInstance.resize();
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

watch(() => props.year, (newYear, oldYear) => {
  console.log(`Year prop changed from ${oldYear} to ${newYear}, isVisible:`, isVisible.value);
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

/* 弹窗 - 与年份选择器二级菜单相同样式 */
.modal-window {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 95vw;
  height: 90vh;
  /* 移除最大宽高限制，以匹配底图大小 */
  /* max-width: 1000px; */
  /* max-height: 700px; */
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
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
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
