<template>
  <div class="land-use-trend-chart">
    <div ref="chartContainer" class="chart-container"></div>
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  seriesData: {
    type: Array,
    default: () => []
  }
})

const chartContainer = shallowRef(null)
const chartInstance = shallowRef(null)

const landTypeMap = {
  'cropland': '耕地',
  'forest': '林地',
  'shrub': '灌木',
  'grassland': '草地',
  'water': '水域',
  'snow_ice': '冰雪',
  'barren': '裸地',
  'impervious': '建设用地',
  'wetland': '湿地'
}

const landUseColors = {
  'cropland': '#FAE39C',
  'forest': '#446F33',
  'shrub': '#33A02C',
  'grassland': '#ABD37B',
  'water': '#1E69B4',
  'snow_ice': '#A6CEE3',
  'barren': '#CFBDA3',
  'impervious': '#E24290',
  'wetland': '#2899E8'
};

// 政策时间轴标记 (云南及国家重大政策)
const policyMarkers = [
  { year: '1999', name: '退耕还林工程启动', color: '#52c41a' },
  { year: '2000', name: '西部大开发战略', color: '#ff4d4f' },
  { year: '2010', name: '低丘缓坡开发利用试点', color: '#faad14' },
  { year: '2012', name: '生态文明建设', color: '#13c2c2' },
  { year: '2018', name: '白鹤滩水电站全面开工', color: '#1890ff' },
  { year: '2021', name: '退林还耕/耕地保护', color: '#f5222d' }
];

const initChart = () => {
  if (!chartContainer.value) return
  chartInstance.value = echarts.init(chartContainer.value)
  updateChart()
}

const updateChart = () => {
  if (!chartInstance.value || !props.seriesData.length) return

  const years = props.seriesData.map(d => d.year).sort((a, b) => a - b);
  const keys = Object.keys(landTypeMap);

  chartInstance.value.clear();

  // 预计算每个指标的全量数据范围，以固定 Y 轴
  const yAxisBounds = {};
  keys.forEach(key => {
    const allData = years.map(year => {
      const record = props.seriesData.find(d => d.year === year);
      return (record ? record[key] : 0) / 1000000;
    });
    const min = Math.min(...allData);
    const max = Math.max(...allData);
    const padding = (max - min) * 0.1 || 1;
    yAxisBounds[key] = {
      min: Math.floor(min - padding),
      max: Math.ceil(max + padding)
    };
  });

  const grids = [];
  const xAxes = [];
  const yAxes = [];
  const series = [];
  const titles = [];

  const cols = 3;
  const rows = 3;
  const leftMargin = 5;
  const rightMargin = 5;
  const topMargin = 8;
  const bottomMargin = 15;
  const hGap = 6;
  const vGap = 12;

  const gridWidth = (100 - leftMargin - rightMargin - hGap * (cols - 1)) / cols;
  const gridHeight = (100 - topMargin - bottomMargin - vGap * (rows - 1)) / rows;

  keys.forEach((key, index) => {
    const r = Math.floor(index / cols);
    const c = index % cols;
    const left = leftMargin + c * (gridWidth + hGap);
    const top = topMargin + r * (gridHeight + vGap);

    grids.push({
      left: left + '%',
      top: top + '%',
      width: gridWidth + '%',
      height: gridHeight + '%',
      containLabel: false
    });

    titles.push({
      text: landTypeMap[key],
      left: (left + gridWidth / 2) + '%',
      top: (top - 6) + '%',
      textAlign: 'center',
      textStyle: { color: '#a5ccff', fontSize: 13, fontWeight: 'bold' }
    });

    xAxes.push({
      gridIndex: index,
      type: 'category',
      boundaryGap: false,
      data: years,
      axisLabel: {
        show: r === rows - 1,
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 10,
        margin: 15,
        interval: 4,
        rotate: 0,
        formatter: '{value}'
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      axisTick: { show: r === rows - 1 }
    });

    yAxes.push({
      gridIndex: index,
      type: 'value',
      min: yAxisBounds[key].min,
      max: yAxisBounds[key].max,
      name: 'km²',
      nameTextStyle: { color: 'rgba(255, 255, 255, 0.4)', fontSize: 10 },
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 9,
        formatter: (value) => value >= 10000 ? (value / 10000).toFixed(1) + '万' : value.toFixed(0)
      },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
    });

    const data = years.map(year => {
      const record = props.seriesData.find(d => d.year === year);
      return (record ? record[key] : 0) / 1000000;
    });

    series.push({
      name: landTypeMap[key],
      type: 'line',
      xAxisIndex: index,
      yAxisIndex: index,
      data: data,
      showSymbol: false,
      smooth: true,
      itemStyle: { color: landUseColors[key] },
      lineStyle: { width: 2.5, shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
      endLabel: {
        show: true,
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
        distance: 10,
        formatter: (params) => params.value.toFixed(0)
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: landUseColors[key] + '44' },
          { offset: 1, color: landUseColors[key] + '00' }
        ])
      },
      markLine: {
        silent: true,
        symbol: ['none', 'none'],
        label: { show: false },
        data: policyMarkers.map(p => ({
          xAxis: p.year,
          name: p.name,
          lineStyle: { color: p.color, type: 'dashed', opacity: 0.3, width: 1 }
        }))
      }
    });
  });

  const option = {
    backgroundColor: 'transparent',
    animationDuration: 5000,
    animationEasing: 'linear',
    title: titles,
    tooltip: {
      trigger: 'axis',
      confine: true,
      appendToBody: true,
      backgroundColor: 'rgba(13, 25, 48, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.15)',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: function (params) {
        const year = params[0].axisValue;
        const record = props.seriesData.find(d => d.year.toString() === year.toString());
        const policy = policyMarkers.find(p => p.year === year);

        let html = `<div style="font-weight:600; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px; color:#a5ccff; display:flex; justify-content:space-between; align-items:center;">`;
        html += `<span>${year}年 全省详情</span>`;
        if (policy) html += `<span style="color:${policy.color}; font-size:11px; background:${policy.color}22; padding:2px 6px; border-radius:4px; border:1px solid ${policy.color}44;">${policy.name}</span>`;
        html += `</div>`;

        if (!record) return html + "暂无数据";

        // 提取所有地类数据并排序
        const allTypes = Object.keys(landTypeMap).map(key => ({
          name: landTypeMap[key],
          value: record[key] / 1000000,
          color: landUseColors[key]
        })).sort((a, b) => b.value - a.value);

        allTypes.forEach(item => {
          const val = item.value;
          const areaStr = val >= 10000 ? (val / 10000).toFixed(2) + ' 万km²' : val.toFixed(2) + ' km²';
          const isCurrentGrid = params.some(p => p.seriesName === item.name);

          html += `<div style="display:flex; justify-content:space-between; align-items:center; margin:6px 0; min-width:240px; opacity: ${isCurrentGrid ? 1 : 0.7}; scale: ${isCurrentGrid ? 1.02 : 1};">
            <span style="display:flex; align-items:center; color:rgba(255,255,255,0.85);">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${item.color}; margin-right:10px; box-shadow:0 0 8px ${item.color}66;"></span>
              <span style="${isCurrentGrid ? 'color:#fff; font-weight:bold;' : ''}">${item.name}</span>
            </span>
            <span style="font-weight:600; margin-left:20px; font-family:'JetBrains Mono', monospace; ${isCurrentGrid ? 'color:#fff;' : 'color:rgba(255,255,255,0.7);'}">${areaStr}</span>
          </div>`;
        });
        return html;
      }
    },
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    series: series
  };

  chartInstance.value.setOption(option);
}

onMounted(() => {
  nextTick(() => {
    initChart()
  })
})

onUnmounted(() => {
  if (chartInstance.value) {
    if (chartInstance.value._resizeObserver) chartInstance.value._resizeObserver.disconnect()
    chartInstance.value.dispose()
  }
})

watch(() => props.seriesData, () => {
  updateChart()
}, { deep: true })
</script>

<style scoped>
.land-use-trend-chart {
  width: 100%;
  height: 100%;
}

.chart-container {
  width: 100%;
  height: 100%;
  min-height: 600px;
}
</style>
