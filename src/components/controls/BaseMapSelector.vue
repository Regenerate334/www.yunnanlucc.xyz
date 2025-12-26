<template>
  <div class="basemap-selector">
    <div class="selector-header" @click="toggleDropdown">
      <span class="selected-map">底图选择</span>
      <svg class="dropdown-icon" :class="{ open: isOpen }" width="12" height="12" viewBox="0 0 12 12">
        <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none" />
      </svg>
    </div>

    <transition name="dropdown">
      <div v-if="isOpen" class="dropdown-menu">
        <div v-for="map in baseMaps" :key="map.id" class="dropdown-item" :class="{ active: selectedMap === map.id }"
          @click="selectMap(map.id)">
          {{ map.name }}
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const emit = defineEmits(['change']);

const selectedMap = ref('imagery'); // 默认影像底图
const isOpen = ref(false);

const baseMaps = [
  { id: 'imagery', name: '天地图影像' },
  { id: 'vector', name: '天地图矢量' },
  { id: 'terrain', name: '天地图地形' }
];

function toggleDropdown() {
  isOpen.value = !isOpen.value;
}

function selectMap(mapId) {
  selectedMap.value = mapId;
  isOpen.value = false;
  emit('change', mapId);
}

// 点击外部关闭下拉菜单
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    if (!e.target.closest('.basemap-selector')) {
      isOpen.value = false;
    }
  });
}
</script>

<style scoped>
.basemap-selector {
  position: relative;
  display: inline-block;
  /* 自适应宽度 */
  user-select: none;
}

.selector-header {
  display: flex;
  align-items: center;
  justify-content: center;
  /* 居中对齐 */
  gap: 8px;
  padding: 8px 12px;
  /* 调整 padding 为 8px，与年份选择器一致 */
  background: rgba(42, 61, 110, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  /* 圆角 6px */
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.selector-header:hover {
  background: rgba(52, 71, 130, 0.4);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.selected-map {
  color: #fff;
  font-size: 13px;
  /* 字体 13px */
  font-weight: 500;
}

.dropdown-icon {
  color: rgba(255, 255, 255, 0.7);
  transition: transform 0.3s ease;
}

.dropdown-icon.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: rgba(42, 61, 110, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  backdrop-filter: blur(8px);
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.dropdown-item {
  padding: 10px 12px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: rgba(72, 91, 150, 0.8);
}

.dropdown-item.active {
  background: rgba(82, 101, 160, 0.6);
  font-weight: 600;
}

/* 下拉动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.3s ease;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
