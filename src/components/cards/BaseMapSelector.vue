<!--
  @component BaseMapSelector
  @description 底图切换组件，提供多种地图底图（影像、矢量、地形）的在线切换功能
  @props 无
  @emits change (切换底图事件，返回底图 ID)
  @dependencies 无
-->
<template>
  <div class="basemap-selector">
    <button class="control-btn" @click.stop="toggleDropdown" title="底图切换">
      <img src="@/assets/icons/business/layer-selector.png" alt="底图" class="icon-img" />
    </button>

    <transition name="dropdown-fade">
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


.dropdown-menu {
  position: absolute;
  bottom: calc(100% + 15px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 140px;
  background: rgba(13, 25, 48, 0.96);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 8px; /* 同步 SpatialLayerSelector 的样式边距 */
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
  z-index: 2600; /* 与 cascading-menu 对齐 */
  display: flex;
  flex-direction: column;
}

.dropdown-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center; /* 确保文字绝对居中 */
  position: relative;
  transition: all 0.2s;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 2px;
}

.dropdown-item:last-child {
  margin-bottom: 0;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.dropdown-item.active {
  background: rgba(59, 130, 246, 0.25);
  color: #60a5fa;
  font-weight: 600;
}

/* 下拉动画同步 cascading-menu */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  /* 必须保留 translateX(-50%) 避免左右横跳，同时 translateY 实现正下正上淡出 */
  transform: translate(-50%, 15px);
}
</style>
