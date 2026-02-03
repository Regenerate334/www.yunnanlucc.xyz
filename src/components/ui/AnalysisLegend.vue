<template>
  <div class="analysis-legend">
    <div class="legend-header">
      <span class="legend-title">{{ title }}</span>
      <span class="legend-unit">{{ unit }}</span>
    </div>
    <div class="legend-items">
      <div v-for="(item, index) in legendItems" :key="index" class="legend-item">
        <span class="color-box" :style="{ background: item.color }"></span>
        <span class="range-text">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: { type: String, default: '图例' },
  unit: { type: String, default: 'km²' },
  breaks: { type: Array, default: () => [] },
  colors: { type: Array, default: () => ['#2ecc71', '#a8d080', '#f1c40f', '#e67e22', '#e74c3c'] }
});

const legendItems = computed(() => {
  if (!props.breaks || props.breaks.length < 2) return [];
  
  const items = [];
  for (let i = 0; i < props.breaks.length - 1; i++) {
    const min = formatNumber(props.breaks[i]);
    const max = formatNumber(props.breaks[i + 1]);
    items.push({
      color: props.colors[i] || props.colors[props.colors.length - 1],
      label: `${min} - ${max}`
    });
  }
  return items.reverse(); // 从高到低显示
});

function formatNumber(num) {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toFixed(0);
}
</script>

<style scoped>
.analysis-legend {
  background: rgba(13, 25, 48, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  min-width: 160px;
}

.legend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.legend-title {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.legend-unit {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-box {
  width: 20px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}

.range-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  font-family: 'Inter', monospace;
}
</style>
