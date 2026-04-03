<!--
  @component SpatialLayerSelector
  @description 空间图层与指标级联选择器，用于在 CLCD、县级和格网等空间统计维度间自由切换
  @props modelValue (图层类型), selectedAttribute (活跃指标), attributes (指标列表)
  @emits update:modelValue, update:selectedAttribute, change
  @dependencies staticIcon (图标资产)
-->
<template>
  <div class="spatial-layer-selector" ref="containerRef">
    <!-- 原有微型入口按钮 -->
    <button 
      class="control-btn" 
      :class="{ active: isOpen || modelValue !== 'clcd' }" 
      @click="toggleDropdown"
      :title="fullLabel"
    >
      <img :src="statisticIcon" alt="统计" />
      <span class="btn-label">{{ currentLabelShort }}</span>
    </button>

    <!-- 级联选择菜单 (向上弹出) -->
    <transition name="dropdown-fade">
      <div v-if="isOpen" class="cascading-menu">
        <!-- 第一级：空间维度 -->
        <div class="menu-column primary">
          <div class="column-header">图层维度</div>
          <div 
            v-for="layer in layers" 
            :key="layer.id" 
            class="menu-item" 
            :class="{ active: modelValue === layer.id, hovered: activeMainLayer === layer.id }"
            @mouseenter="activeMainLayer = layer.id"
            @click="selectMainLayer(layer.id)"
          >
            <span class="indicator primary" v-if="modelValue === layer.id"></span>
            <span class="item-text">{{ layer.name }}</span>
            <span class="chevron">›</span>
          </div>
        </div>

        <!-- 第二级：分析指标 / 数据显示 -->
        <div class="menu-column secondary">
          <div class="column-header">
            {{ activeMainLayer === 'clcd' ? '数据显示' : '分析指标' }}
          </div>
          <div class="scroll-container">
            <!-- 土地覆盖模式：显示全地类状态 -->
            <template v-if="activeMainLayer === 'clcd'">
              <div class="menu-item selected">
                <span class="indicator"></span>
                <span class="item-text">全部地类 (覆盖)</span>
              </div>
              <!-- 显示其余指标作为参考（不可选） -->
              <div 
                v-for="attr in attributes" 
                :key="attr.value" 
                class="menu-item disabled"
              >
                <span class="item-text dimmed">{{ attr.label }}</span>
              </div>
            </template>
            
            <!-- 县级/网格模式：正常选择指标 -->
            <template v-else>
              <div 
                v-for="attr in filteredAttributes" 
                :key="attr.value" 
                class="menu-item" 
                :class="{ selected: selectedAttribute === attr.value }"
                @click="selectAttribute(attr.value)"
              >
                <span class="indicator" v-if="selectedAttribute === attr.value"></span>
                <span class="item-text">{{ attr.label }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import statisticIcon from '@/assets/icons/business/layer-stats.png';

const props = defineProps({
  modelValue: {
    type: String,
    default: 'clcd'
  },
  selectedAttribute: {
    type: String,
    default: 'cropland'
  },
  attributes: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:modelValue', 'update:selectedAttribute', 'change']);

const isOpen = ref(false);
const containerRef = ref(null);
const activeMainLayer = ref(props.modelValue);

watch(isOpen, (val) => {
  if (val) activeMainLayer.value = props.modelValue;
});

const layers = [
  { id: 'clcd', name: '土地覆盖' },
  { id: 'county', name: '县级统计' },
  { id: 'grid', name: '网格统计' }
];

const filteredAttributes = computed(() => {
  if (activeMainLayer.value === 'grid') {
    return props.attributes.filter(a => a.value !== 'shrub');
  }
  return props.attributes;
});

const fullLabel = computed(() => {
  const layer = layers.find(l => l.id === props.modelValue);
  const attr = props.attributes.find(a => a.value === props.selectedAttribute);
  if (props.modelValue === 'clcd') return layer?.name;
  return `${layer?.name} - ${attr?.label || ''}`;
});

const currentLabelShort = computed(() => {
  if (props.modelValue === 'clcd') return '覆盖';
  if (props.modelValue === 'county') return '县级';
  if (props.modelValue === 'grid') return '格网';
  return '统计';
});

function toggleDropdown() {
  isOpen.value = !isOpen.value;
}

function selectMainLayer(layerId) {
  emit('update:modelValue', layerId);
  activeMainLayer.value = layerId;
  
  if (layerId === 'clcd') {
    // 延迟自动关闭，给用户一点反馈感
    setTimeout(() => {
      if (activeMainLayer.value === 'clcd') isOpen.value = false;
    }, 400);
  }
}

function selectAttribute(attrValue) {
  if (props.modelValue !== activeMainLayer.value) {
    emit('update:modelValue', activeMainLayer.value);
  }
  emit('update:selectedAttribute', attrValue);
  isOpen.value = false;
}

const handleClickOutside = (e) => {
  if (containerRef.value && !containerRef.value.contains(e.target)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  window.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.spatial-layer-selector {
  position: relative;
  display: inline-block;
  pointer-events: auto;
}

/* 级联菜单容器：完全固定宽高，消除任何抖动 */
.cascading-menu {
  position: absolute;
  bottom: calc(100% + 15px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(13, 25, 48, 0.96);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  display: flex;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
  z-index: 2600;
  overflow: hidden;
  width: 300px; /* 固定总宽度 */
  height: 380px; /* 固定总高度 */
}

.menu-column {
  width: 150px;
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.menu-column.primary {
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.menu-column.secondary {
  background: rgba(255, 255, 255, 0.02);
}

.column-header {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  padding: 6px 12px 10px;
  letter-spacing: 1px;
}

.scroll-container {
  flex-grow: 1;
  overflow-y: auto;
}

.scroll-container::-webkit-scrollbar {
  width: 4px;
}
.scroll-container::-webkit-scrollbar-track {
  background: transparent;
}
.scroll-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.menu-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center; /* 确保文字绝对居中 */
  position: relative;
  transition: all 0.2s;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 2px;
}

/* 移除不再需要的 item-left 容器样式 */

.menu-item:hover, .menu-item.hovered {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.menu-item.active {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
}

.menu-item.selected {
  background: rgba(59, 130, 246, 0.25);
  color: #60a5fa;
}

.menu-item.disabled {
  cursor: default;
  background: transparent !important;
  pointer-events: none;
}

.dimmed {
  opacity: 0.3;
}

.chevron {
  position: absolute;
  right: 12px;
  font-size: 16px;
  opacity: 0.4;
  line-height: 1;
}

.indicator {
  position: absolute;
  left: 12px;
  width: 5px;
  height: 5px;
  background: #60a5fa;
  border-radius: 50%;
  box-shadow: 0 0 8px #60a5fa;
  flex-shrink: 0;
}

.item-text {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

/* 动画效果 */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 15px);
}
</style>
