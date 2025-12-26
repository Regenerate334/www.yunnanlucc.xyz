<template>
  <div class="land-use-trend-chart">
    <div ref="chartContainer" class="chart-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  seriesData: {
    type: Array,
    default: () => []
  }
})

const chartContainer = ref(null)
const chartInstance = ref(null)

// 土地利用类型映射（英文 -> 中文）
const landTypeMap = {
  'Cropland': '耕地',
  'Forest': '林地',
  'Shrub': '灌木',
  'Grassland': '草地',
  'Water': '水域',
  'Snow/Ice': '冰雪',
  'Barren': '裸地',
  'Impervious': '建设用地',
  'Wetland': '湿地'
}

// 将宽表数据转换为长表数据 [Year, Type, Area]
const rawData = computed(() => {
  if (!props.seriesData || props.seriesData.length === 0) return []

  // Header row
  const result = [['Year', 'Type', 'Area']]

  props.seriesData.forEach(item => {
    const year = item.year
    Object.keys(landTypeMap).forEach(key => {
      // key 是英文名 (如 Cropland), landTypeMap[key] 是中文名 (如 耕地)
      // 数据中的 key 是小写 (如 cropland)
      const dataKey = key.toLowerCase() === 'snow/ice' ? 'snow_ice' : key.toLowerCase()
      const area = item[dataKey]
      if (area !== undefined) {
        result.push([year, landTypeMap[key], area])
      }
    })
  })

  return result
})

const run = (_rawData) => {
  if (!chartInstance.value) return;

  // 确保图表容器有尺寸
  chartInstance.value.resize();

  const countries = Object.values(landTypeMap); // 对应示例中的 countries
  const datasetWithFilters = [];
  const seriesList = [];

  echarts.util.each(countries, function (country) {
    var datasetId = 'dataset_' + country;
    datasetWithFilters.push({
      id: datasetId,
      fromDatasetId: 'dataset_raw',
      transform: {
        type: 'filter',
        config: {
          and: [
            { dimension: 'Type', '=': country }
          ]
        }
      }
    });
    seriesList.push({
      type: 'line',
      datasetId: datasetId,
      showSymbol: false,
      name: country,
      endLabel: {
        show: true,
        formatter: function (params) {
          // params.value: [Year, Type, Area]
          return params.value[1] + ': ' + Math.round(params.value[2]);
        },
        color: 'inherit' // 继承系列颜色
      },
      labelLayout: {
        moveOverlap: 'shiftY'
      },
      emphasis: {
        focus: 'series'
      },
      encode: {
        x: 'Year',
        y: 'Area',
        label: ['Type', 'Area'],
        itemName: 'Year',
        tooltip: ['Area']
      }
    });
  });

  const option = {
    animationDuration: 3000, // 保持动画
    dataset: [
      {
        id: 'dataset_raw',
        source: _rawData
      },
      ...datasetWithFilters
    ],
    tooltip: {
      order: 'valueDesc',
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.5)'
        }
      },
      backgroundColor: 'rgba(50, 50, 50, 0.9)',
      borderColor: '#999',
      borderWidth: 1,
      textStyle: { color: '#fff' }
    },
    xAxis: {
      type: 'category',
      nameLocation: 'middle',
      axisLabel: { color: '#fff' }, // 适配暗色背景
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.3)' } }
    },
    yAxis: {
      type: 'log',
      name: '面积 (km²)',
      nameTextStyle: { color: '#fff' },
      axisLabel: { color: '#fff' },
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.3)' } },
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      logBase: 10
    },
    grid: {
      right: 100, // 为 endLabel 留出空间
      top: 40,
      bottom: 30,
      left: 60
    },
    series: seriesList
  };

  chartInstance.value.setOption(option);
}

const initChart = () => {
  if (!chartContainer.value) return
  chartInstance.value = echarts.init(chartContainer.value)

  // Use ResizeObserver to handle container resize
  const resizeObserver = new ResizeObserver(() => {
    if (chartInstance.value) {
      chartInstance.value.resize()
    }
  })
  resizeObserver.observe(chartContainer.value)

  // Store observer to disconnect later
  chartInstance.value._resizeObserver = resizeObserver
}

onMounted(() => {
  nextTick(() => {
    initChart()
    if (rawData.value.length > 1) {
      run(rawData.value)
    }
  })
})

onUnmounted(() => {
  if (chartInstance.value) {
    if (chartInstance.value._resizeObserver) {
      chartInstance.value._resizeObserver.disconnect()
    }
    chartInstance.value.dispose()
  }
})

watch(() => props.seriesData, () => {
  if (rawData.value.length > 1) {
    run(rawData.value)
  }
}, { deep: true })

</script>

<style scoped>
.land-use-trend-chart {
  width: 100%;
  height: 100%;
  position: relative;
}

.chart-container {
  width: 100%;
  height: 100%;
  min-height: 300px;
}
</style>
