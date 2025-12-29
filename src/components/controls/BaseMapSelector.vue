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
import { ref, computed, onMounted, onUnmounted } from 'vue';

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

const handleClickOutside = (e) => {
  if (!e.target.closest('.basemap-selector')) {
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
.basemap-selector {
  position: relative;
  display: inline-block;
  user-select: none;
}

.selector-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(13, 25, 48, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  backdrop-filter: blur(16px);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.selector-header:hover {
  background: rgba(30, 58, 138, 0.4);
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.selected-map {
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}

.dropdown-icon {
  color: #a5ccff;
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
  min-width: 140px;
  background: rgba(13, 25, 48, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  backdrop-filter: blur(20px);
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  z-index: 1000;
}

.dropdown-item {
  padding: 12px 16px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: rgba(59, 130, 246, 0.1);
  color: #ffffff;
}

.dropdown-item.active {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
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
