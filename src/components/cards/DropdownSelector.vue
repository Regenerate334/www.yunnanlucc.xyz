<!--
  @component DropdownSelector
  @description 通用下拉选择器组件，支持图标插槽、自适应宽度及美化交互
  @props modelValue (绑定值), options (选项列表), width (宽度), placeholder (占位符), iconOnly (仅图标模式), title (悬浮提示)
  @emits update:modelValue (双向绑定), change (选中项变化)
  @dependencies 无
-->
<template>
  <div class="dropdown-selector" :style="{ width: computedWidth }">
    <!-- 主按钮 -->
    <div 
      class="display-button" 
      ref="buttonRef" 
      :class="{ active: isOpen, 'icon-only': iconOnly }" 
      @click="togglePopover"
      :title="title"
    >
      <!-- 图标插槽 -->
      <div v-if="$slots.icon || icon" class="icon-wrapper">
        <slot name="icon">
          <!-- 默认渲染传入的 icon 组件或 SVG -->
        </slot>
      </div>

      <!-- 文本显示 (非仅图标模式) -->
      <span v-if="!iconOnly" class="button-text">{{ displayLabel }}</span>

      <!-- 下拉箭头 (可选) -->
      <svg v-if="!iconOnly || showChevron" class="chevron-icon" :class="{ open: isOpen }" width="12" height="12" viewBox="0 0 12 12">
        <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <!-- 弹出面板 -->
    <transition name="fade">
      <div v-if="isOpen" class="popover-panel" ref="popoverRef">
        <div 
          v-for="option in options" 
          :key="option.value" 
          class="dropdown-item" 
          :class="{ selected: modelValue === option.value }"
          @click="selectOption(option)"
        >
          {{ option.label }}
        </div>
      </div>
    </transition>

    <!-- 背景遮罩 (透明) -->
    <div v-if="isOpen" class="backdrop" @click="closePopover"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  options: {
    type: Array, // [{ label: 'Label', value: 'val' }]
    default: () => []
  },
  width: {
    type: [Number, String],
    default: 'auto'
  },
  placeholder: {
    type: String,
    default: '请选择'
  },
  iconOnly: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  showChevron: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['update:modelValue', 'change']);

const isOpen = ref(false);
const buttonRef = ref(null);
const popoverRef = ref(null);

const computedWidth = computed(() => {
  if (typeof props.width === 'number') return `${props.width}px`;
  return props.width;
});

const displayLabel = computed(() => {
  const selected = props.options.find(opt => opt.value === props.modelValue);
  return selected ? selected.label : props.placeholder;
});

function togglePopover() {
  isOpen.value = !isOpen.value;
}

function closePopover() {
  isOpen.value = false;
}

function selectOption(option) {
  emit('update:modelValue', option.value);
  emit('change', option.value);
  closePopover();
}

// 点击外部关闭
function handleClickOutside(event) {
  if (buttonRef.value && buttonRef.value.contains(event.target)) return;
  if (popoverRef.value && popoverRef.value.contains(event.target)) return;
  closePopover();
}

// 这里的 backdrop 已经处理了大部分点击外部的情况，但在某些交互下（如嵌套）可能需要全局监听
// closePopover 也就是 backdrop 的 click handler
</script>

<style scoped>
.dropdown-selector {
  position: relative;
  display: inline-block;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.display-button {
  display: flex;
  align-items: center;
  justify-content: center; /* 默认居中，适合 icon-only */
  gap: 8px;
  background: rgba(13, 25, 48, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 0 12px;
  height: 40px; /* 固定高度与 YearSelector 一致 */
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(16px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: #fff;
}

.display-button:not(.icon-only) {
    justify-content: center; /* Force center alignment */
}

.display-button:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(30, 58, 138, 0.4);
  transform: translateY(-1px);
}

.display-button.active {
  background: #3B76E1 !important;
  border-color: #3B76E1;
  color: #ffffff;
  box-shadow: 0 4px 10px rgba(59, 118, 225, 0.3);
}

.display-button.active .icon-wrapper,
.display-button.active .chevron-icon {
  color: #ffffff;
}

/* 图标容器 */
.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a5ccff;
}

.button-text {
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
  white-space: nowrap;
}

.chevron-icon {
  color: rgba(255, 255, 255, 0.4);
  transition: transform 0.3s ease;
}

.chevron-icon.open {
  transform: rotate(180deg);
}

/* 弹出面板 */
.popover-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 100%; /* 至少与按钮同宽 */
  width: max-content; /* 自适应内容宽度，防止截断 */
  max-width: 300px; /* 限制最大宽度 */
  background: rgba(13, 25, 48, 0.6); /* 深色磨砂背景 */
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  z-index: 1200; /* Higher than toolbar containers (1100) */
  padding: 6px;
  backdrop-filter: blur(20px);
  max-height: 220px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 自定义滚动条样式 */
.popover-panel::-webkit-scrollbar {
  width: 4px;
}

.popover-panel::-webkit-scrollbar-track {
  background: transparent;
}

.popover-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

.popover-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.dropdown-item {
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
  transition: all 0.2s ease;
  white-space: nowrap;
  text-align: left;
}

.dropdown-item:hover {
  background: rgba(59, 130, 246, 0.1);
  color: #ffffff;
}

.dropdown-item.selected {
  background: rgba(59, 130, 246, 0.8); /* 选中高亮 */
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1050; /* 低于 popover 但高于其他 */
  cursor: default;
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
