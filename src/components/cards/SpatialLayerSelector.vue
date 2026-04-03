<!--
  @component SpatialLayerSelector
  @description 空间图层与指标级联选择器，用于在 CLCD、县级和格网等空间统计维度间自由切换
  @props modelValue (图层类型), selectedAttribute (活跃指标), attributes (指标列表)
  @emits update:modelValue, update:selectedAttribute, change
  @dependencies staticIcon (图标资产)
-->
<template>
  <div class="spatial-layer-selector" ref="containerRef">
    <!-- 入口按钮 -->
    <button 
      class="control-btn" 
      :class="{ active: isOpen || modelValue !== 'clcd' }" 
      @click="toggleDropdown"
      :title="fullLabel"
    >
      <img :src="statisticIcon" alt="统计" />
      <span class="btn-label">{{ currentLabelShort }}</span>
    </button>

    <!-- 卡片式选择面板 (向上弹出) -->
    <transition name="panel-slide">
      <div v-if="isOpen" class="layer-selector-panel panel-card">
        <div class="panel-header">
          <h1 class="header-title">统计图层选择</h1>
          <button class="close-btn" @click="isOpen = false" title="关闭">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="control-body">
          <!-- 空间维度切换 -->
          <div class="control-section">
            <div class="section-label">图层维度</div>
            <div class="segmented-control">
              <button 
                v-for="layer in layers" 
                :key="layer.id"
                :class="{ active: activeMainLayer === layer.id }" 
                @click="selectMainLayer(layer.id)"
              >
                {{ layer.name.replace('统计', '') }}
              </button>
            </div>
          </div>

          <!-- 指标选择列表 -->
          <div class="control-section">
            <div class="section-label">
              {{ activeMainLayer === 'clcd' ? '数据显示' : '分析指标' }}
            </div>
            <div class="indicator-scroll-list">
              <!-- 土地覆盖模式 -->
              <template v-if="activeMainLayer === 'clcd'">
                <div class="list-item selected disabled">
                  <span class="indicator-dot"></span>
                  <span class="item-text">全部地类 (覆盖)</span>
                </div>
                <div 
                  v-for="attr in attributes" 
                  :key="attr.value" 
                  class="list-item disabled dimmed"
                >
                  <span class="item-text">{{ attr.label }}</span>
                </div>
              </template>
              
              <!-- 县级/网格模式 -->
              <template v-else>
                <div 
                  v-for="attr in filteredAttributes" 
                  :key="attr.value" 
                  class="list-item" 
                  :class="{ selected: selectedAttribute === attr.value }"
                  @click="selectAttribute(attr.value)"
                >
                  <span class="indicator-dot" v-if="selectedAttribute === attr.value"></span>
                  <span class="item-text">{{ attr.label }}</span>
                  <svg v-if="selectedAttribute === attr.value" class="check-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              </template>
            </div>
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
  activeMainLayer.value = layerId;
  
  // 优化：切换维度时立即触发更新，不再等待指标点击
  if (props.modelValue !== layerId) {
    emit('update:modelValue', layerId);
  }
}

function selectAttribute(attrValue) {
  // 确保维度状态同步
  if (props.modelValue !== activeMainLayer.value) {
    emit('update:modelValue', activeMainLayer.value);
  }
  emit('update:selectedAttribute', attrValue);
  // 不再自动关闭，由用户决定
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

/* 卡片式面板容器 - 对齐 LandTransferControl 风格 */
.layer-selector-panel {
  position: absolute;
  bottom: calc(100% + 15px);
  left: 50%;
  transform: translateX(-50%);
  width: 280px;
  background: rgba(30, 45, 90, 0.95);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  color: #E2E8F0;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  overflow: hidden;
}

/* 气泡尖角 */
.layer-selector-panel::after {
  content: '';
  position: absolute;
  bottom: -6px; 
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 12px;
  height: 12px;
  background: inherit; 
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  z-index: -1; 
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #fff;
  margin: 0;
}

.close-btn {
  position: absolute;
  right: 10px;
  background: rgba(245, 108, 108, 0.15); /* 默认开启半透明红 */
  border: none;
  color: #F56C6C; /* 默认红色 */
  cursor: pointer;
  width: 34px; /* 统一放大一致 */
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  border-radius: 50%;
}

.close-btn:hover {
  background: rgba(245, 108, 108, 0.25);
  color: #fff;
  transform: rotate(90deg) scale(1.1);
}

.control-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-left: 10px;
  position: relative;
}

.section-label::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 10px;
  background: #3B76E1;
  border-radius: 1px;
}

/* 分段控制组件 */
.segmented-control {
  display: flex;
  background: rgba(0, 0, 0, 0.25);
  padding: 3px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.segmented-control button {
  flex: 1;
  padding: 6px 0;
  background: transparent;
  border: none;
  color: #94A3B8;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 7px;
  transition: all 0.3s;
}

.segmented-control button.active {
  background: #3B76E1;
  color: white;
  box-shadow: 0 4px 12px rgba(59, 118, 225, 0.25);
}

/* 指标滚动列表 */
.indicator-scroll-list {
  max-height: 200px;
  overflow-y: auto;
  padding-right: 4px;
}

.indicator-scroll-list::-webkit-scrollbar {
  width: 4px;
}
.indicator-scroll-list::-webkit-scrollbar-track {
  background: transparent;
}
.indicator-scroll-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.list-item {
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  position: relative;
  transition: all 0.2s;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 2px;
}

.list-item:hover:not(.disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.list-item.selected {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  font-weight: 600;
}

.list-item.disabled {
  cursor: default;
  opacity: 0.5;
}

.indicator-dot {
  width: 6px;
  height: 6px;
  background: #60a5fa;
  border-radius: 50%;
  margin-right: 12px;
  box-shadow: 0 0 8px #60a5fa;
}

.item-text {
  font-size: 13px;
  flex: 1;
}

.check-icon {
  margin-left: 8px;
  opacity: 0.8;
}

.dimmed {
  opacity: 0.2 !important;
}

/* 面板滑入动画 */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, 15px) scale(0.95);
}
</style>

