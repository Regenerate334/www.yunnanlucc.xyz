<template>
  <div v-if="legendItems && legendItems.length > 0" class="vibe-legend-container">
    <div class="vibe-legend-header">
      <div class="vibe-legend-title">{{ displayTitle }}</div>
    </div>
    <div class="vibe-legend-list">
      <div v-for="(item, index) in legendItems" :key="index" class="vibe-legend-item">
        <span class="vibe-legend-swatch" :style="{ background: item.color }"></span>
        <span class="vibe-legend-text">{{ formatLegendLabel(item.label) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useGlobalStore } from '../../stores/global.ts';

const globalStore = useGlobalStore();

const props = defineProps({
  title: { type: String, default: '' },
  items: { type: Array, default: null } 
});

const displayTitle = computed(() => props.title || globalStore.legendData?.title || '分析图例');

const legendItems = computed(() => {
  if (props.items) return props.items;
  if (globalStore.legendData?.items) {
    return globalStore.legendData.items;
  }
  return [];
});

/**
 * 格式化数值：是整数不带小数点
 */
function formatValue(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  return Number.isInteger(num) ? num.toString() : num.toFixed(2);
}

/**
 * 格式化图例标签
 */
function formatLegendLabel(label) {
  if (!label || typeof label !== 'string') return label;
  
  if (label.includes('-')) {
    const parts = label.split('-');
    if (parts.length === 2) {
      return `${formatValue(parts[0].trim())} - ${formatValue(parts[1].trim())}`;
    }
  }
  
  return formatValue(label);
}
</script>

<style scoped>
/* 使用全局 vibe-legend 样式，此处不再定义冗余 CSS */
</style>
