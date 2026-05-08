<!-- AnalysisLegend: 数据可视化图例组件 -->
<!--
  @component AnalysisLegend
  @description 用于展示地图数据的图例说明，支持自定义区间颜色分级及悬浮固定显示，内置自适应区间及百分比简化格式功能。
  @props title (标题), items (自定义图例项), breaks (分级断点), colors (分级颜色), floating (是否悬浮显示), side, left, right, top, bottom, yAnchor, width, zIndex (样式控制)
  @dependencies globalStore (全局状态获取图例数据)
-->
<template>
  <div class="legend-rail" :style="containerStyle">
    <div v-if="displayTitle" class="legend-title">{{ displayTitle }}</div>
    <div class="legend-bar-container">
      <div 
        v-for="(item, index) in legendItems" 
        :key="index"
        class="legend-item"
        :title="item.label"
      >
        <div 
          class="legend-block"
          :style="{ background: item.color }"
        ></div>
        <div class="legend-label">{{ item.label }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useGlobalStore } from '../../stores/index.ts';

const globalStore = useGlobalStore();

// 定义组件接收的属性配置
const props = defineProps({
  title: { type: String, default: '' },
  items: { type: Array, default: null },
  breaks: { type: Array, default: null },
  colors: { type: Array, default: null },
  floating: { type: Boolean, default: true },
  side: { type: String, default: 'left' },
  left: { type: Number, default: 560 },
  right: { type: Number, default: 24 },
  top: { type: Number, default: 116 },
  bottom: { type: Number, default: 24 },
  yAnchor: { type: String, default: 'bottom' },
  width: { type: Number, default: 620 },
  zIndex: { type: Number, default: 2100 }
});

// 计算要展示的标题，优先使用传入的 props，其次使用 store 中的全局数据
const displayTitle = computed(() => props.title || globalStore.legendData?.title || '');

// 计算图例项列表：处理直接传入、区间颜色分级计算、或者全局 store 数据
const legendItems = computed(() => {
  let rawItems = [];
  if (Array.isArray(props.items) && props.items.length > 0) {
    // 1. 直接使用传入的预设图例项
    rawItems = props.items;
  } else if (
    Array.isArray(props.breaks) &&
    props.breaks.length > 1 &&
    Array.isArray(props.colors) &&
    props.colors.length > 0
  ) {
    // 2. 根据给定的断点和颜色数组计算颜色分级区间
    rawItems = props.breaks.slice(0, -1).map((start, index) => {
      const end = props.breaks[index + 1];
      return {
        color: props.colors[index] || props.colors[props.colors.length - 1],
        label: `${start}-${end}`
      };
    });
  } else {
    // 3. 兜底使用全局状态中的图例数据
    rawItems = globalStore.legendData?.items || [];
  }

  // 统一进行二次格式化：处理区间简化为单值并剥离百分比符号
  return rawItems.map(item => ({
    ...item,
    label: simplifyLabel(item.label)
  }));
});

/**
 * 简化图例标签的显示文本
 * @param {string|number} label 原始标签文本
 * @returns {string} 简化后的标签文本
 */
function simplifyLabel(label) {
  if (label === undefined || label === null) return '';
  const str = String(label);
  // 恢复区间显示，但为了防止重叠，使用无空格的紧凑格式并剥离百分比
  if (str.includes('-')) {
    const parts = str.split('-').map(p => formatValue(p.trim()));
    return parts.join('-');
  }
  return formatValue(str);
}

// 计算图例外层容器的样式，处理固定定位与悬浮逻辑
const containerStyle = computed(() => {
  const style = {
    zIndex: String(props.zIndex),
    width: `min(${props.width}px, calc(100vw - 32px))`
  };

  if (!props.floating) return style;

  style.position = 'fixed';
  if (props.yAnchor === 'top') {
    style.top = `${props.top}px`;
    style.bottom = 'auto';
  } else {
    style.bottom = `${props.bottom}px`;
    style.top = 'auto';
  }
  if (props.side === 'left') {
    style.left = `${props.left}px`;
    style.right = 'auto';
  } else {
    style.right = `${props.right}px`;
    style.left = 'auto';
  }
  return style;
});

/**
 * 格式化数值文本：处理剥离百分比及小数点精度控制
 * @param {string|number} val 需要格式化的值
 * @returns {string} 格式化后的字符串
 */
function formatValue(val) {
  if (val === undefined || val === null) return '0';
  // 剥离百分比符号，统一由标题展示单位
  let strVal = String(val).replace('%', '').trim();
  
  if (/[^\d.-]/.test(strVal)) return strVal;
  const num = parseFloat(strVal);
  if (Number.isNaN(num)) return strVal;
  
  if (num === 0) return '0';
  if (num < 10) return num.toFixed(2).replace(/\.?0+$/, '');
  if (num < 100) return num.toFixed(1).replace(/\.?0+$/, '');
  return Math.round(num).toString();
}
</script>

<style scoped>
.legend-rail {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  /* 匹配项目深色玻璃拟态效果 */
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  pointer-events: auto;
}

.legend-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 2px;
  letter-spacing: 0.5px;
  text-align: center;
}

.legend-bar-container {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 0;
}

.legend-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0; /* 允许收缩 */
}

.legend-block {
  height: 8px;
  width: 100%;
  transition: all 0.2s ease;
}

/* 首尾色块圆角处理，保持整体条状感 */
.legend-item:first-child .legend-block {
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}

.legend-item:last-child .legend-block {
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}

.legend-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 2px;
}

.legend-item:hover .legend-label {
  color: #fff;
  overflow: visible;
  z-index: 10;
}
</style>
