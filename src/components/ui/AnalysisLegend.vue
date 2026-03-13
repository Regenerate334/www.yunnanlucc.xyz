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

<style>
/* ==========================================================================
   VIBE GLOBAL LEGEND SYSTEM - Fused into Component
   ========================================================================== */

.vibe-legend-container {
  width: 190px;
  padding: 16px;
  box-sizing: border-box;
  background: rgba(23, 35, 46, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  font-family: inherit;
  pointer-events: auto;
}

.vibe-legend-header {
  display: flex;
  justify-content: center;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  margin-bottom: 12px;
}

.vibe-legend-title {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  line-height: 1.5;
  white-space: normal;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.vibe-legend-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.vibe-legend-item {
  display: flex;
  align-items: center;
  height: 20px;
  gap: 10px;
}

.vibe-legend-swatch {
  width: 24px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.vibe-legend-text {
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
</style>
