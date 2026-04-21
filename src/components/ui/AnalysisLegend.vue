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

const displayTitle = computed(() => props.title || globalStore.legendData?.title || '');

const legendItems = computed(() => {
  let rawItems = [];
  if (Array.isArray(props.items) && props.items.length > 0) {
    rawItems = props.items;
  } else if (
    Array.isArray(props.breaks) &&
    props.breaks.length > 1 &&
    Array.isArray(props.colors) &&
    props.colors.length > 0
  ) {
    rawItems = props.breaks.slice(0, -1).map((start, index) => {
      const end = props.breaks[index + 1];
      return {
        color: props.colors[index] || props.colors[props.colors.length - 1],
        label: `${start}-${end}`
      };
    });
  } else {
    rawItems = globalStore.legendData?.items || [];
  }

  // 统一进行二次格式化：处理区间简化为单值 + 剥离百分比
  return rawItems.map(item => ({
    ...item,
    label: simplifyLabel(item.label)
  }));
});

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
