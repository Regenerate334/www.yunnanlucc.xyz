<!-- RegionSelector: 行政区划选择器 -->
<!--
  @component RegionSelector
  @description 悬浮在地图上方的行政区划级联选择器，支持通过点击三级联动面板（省、市、县）和模糊搜索快速定位目标区域。
  @props 无外部 props，完全依赖全局 store 状态驱动
  @emits 内部直接调用 globalStore 方法修改作用域，无需 emit
  @dependencies globalStore (全局状态获取及更新层级作用域), regionApi (请求行政区划层级结构数据)
-->
<template>
  <div class="region-selector-trigger" :class="{ 'is-active': isExpanded }">
    <!-- 按钮主体：使用官方 png 图标 -->
    <button 
      class="region-btn" 
      @click="toggleExpanded" 
      tabindex="-1"
      :title="selectedCounty || selectedCity || '行政区划选择'"
    >
      <img :src="regionIcon" alt="地区选择" class="icon-img icon" />
      <!-- 弱化高亮：极简半透明标签 -->
      <span class="region-label" v-if="!isExpanded && (selectedCity || selectedCounty)">
         {{ selectedCounty || selectedCity }}
      </span>
    </button>

    <!-- 三栏级联选择面板 (向上弹出，540px 宽度对齐 RegionCascader) -->
    <transition name="panel-slide-up">
      <div v-if="isExpanded" class="selection-panel floating-glass">
        <div class="panel-header">
           <div class="search-input-wrapper">
             <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
               <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
             </svg>
             <input 
               v-model="searchQuery" 
               type="text" 
               placeholder="搜索地州或区县..." 
               ref="searchInput"
               @keyup.enter.prevent="handleSearchEnter"
             />
             <button class="close-panel-btn" @click="globalStore.setActivePanel(null)">×</button>
           </div>
        </div>

        <div class="panel-body">
          <template v-if="!searchQuery">
            <div class="columns-container">
              <!-- 第一栏：省级 -->
              <div class="column province-col">
                <div class="column-title">省直辖市</div>
                <div class="list-wrapper">
                  <div 
                    class="list-item" 
                    :class="{ active: globalStore.scope.level === 'province' }"
                    @click="onProvinceSelect"
                  >
                    云南省
                  </div>
                </div>
              </div>

              <!-- 第二栏：地级市 -->
              <div class="column city-col">
                <div class="column-title">地级市州</div>
                <div class="list-wrapper custom-scrollbar">
                  <div 
                    v-for="city in hierarchy" 
                    :key="city.code" 
                    class="list-item"
                    :class="{ active: selectedCity === city.name }"
                    @mouseenter="hoveredCity = city.name"
                    @click="onCitySelect(city)"
                  >
                    <span class="item-text">{{ city.name }}</span>
                    <svg class="arrow" viewBox="0 0 24 24" width="12" height="12"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2.5" /></svg>
                  </div>
                </div>
              </div>

              <!-- 第三栏：县级 -->
              <div class="column county-col">
                <div class="column-title">区县旗</div>
                <div class="list-wrapper custom-scrollbar">
                  <template v-if="currentHoveredCityObj || currentCityObj">
                    <div 
                      v-for="county in (currentHoveredCityObj?.children || currentCityObj?.children)" 
                      :key="county.code || county" 
                      class="list-item"
                      :class="{ active: selectedCounty === (county.name || county) }"
                      @click="onCountySelect(county)"
                    >
                      {{ county.name || county }}
                    </div>
                  </template>
                  <div v-else class="empty-hint">请悬停或选择地市</div>
                </div>
              </div>
            </div>
          </template>

          <!-- 搜索结果栏 -->
          <template v-else>
            <div class="search-results custom-scrollbar">
               <div v-if="searchResults.length === 0" class="no-results">未找到相关区域</div>
               <div v-for="res in searchResults" :key="res.code + res.name" class="result-item" @click="onResultClick(res)">
                 <div class="res-info">
                   <div class="res-name">{{ res.name }}</div>
                   <div class="res-path">{{ res.path }}</div>
                 </div>
                 <div class="res-badge">{{ res.levelLabel }}</div>
               </div>
            </div>
          </template>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useGlobalStore } from '../../stores/global';
import { regionApi } from '../../api/index.js';
import regionIcon from '../../assets/icons/common/region_selector.png';

const globalStore = useGlobalStore();
const panelName = 'region_selection';

// 计算当前选择面板是否处于展开激活状态
const isExpanded = computed(() => globalStore.activePanel === panelName);
const searchQuery = ref('');
const hierarchy = ref([]);
const searchInput = ref(null);

// 状态：当前选中的市、县，以及鼠标悬停预览的市
const selectedCity = ref('');
const selectedCounty = ref('');
const hoveredCity = ref('');

// 根据当前选中的城市名称，获取对应的城市数据对象
const currentCityObj = computed(() => {
  return hierarchy.value.find(c => c.name === selectedCity.value);
});

// 根据当前鼠标悬停的城市名称，获取对应的城市数据对象，用于展示子级区县
const currentHoveredCityObj = computed(() => {
  return hierarchy.value.find(c => c.name === hoveredCity.value);
});

// 根据输入框查询词汇实时计算搜索结果（支持地级市和区县名匹配）
const searchResults = computed(() => {
  if (!searchQuery.value) return [];
  const query = searchQuery.value.toLowerCase();
  const results = [];

  hierarchy.value.forEach(city => {
    // 匹配地级市
    if (city.name.toLowerCase().includes(query)) {
      results.push({ name: city.name, code: city.code, level: 'prefecture', levelLabel: '地级', path: '云南省' });
    }
    // 匹配县级区域
    if (city.children) {
      city.children.forEach(county => {
        const cName = county.name || county;
        if (cName.toLowerCase().includes(query)) {
          results.push({ 
            name: cName, code: county.code || '', level: 'county', levelLabel: '县级', 
            path: `云南省 / ${city.name}`, parentCity: city.name 
          });
        }
      });
    }
  });
  return results.slice(0, 20);
});

/**
 * 获取行政区划层级数据树，并同步当前 store 中的状态
 */
async function fetchHierarchy() {
  try {
    const data = await regionApi.getRegionHierarchy();
    hierarchy.value = data;
    syncFromStore();
  } catch (e) { console.error(e); }
}

/**
 * 根据 globalStore 中的全局作用域状态同步本地组件的高亮选中状态
 */
function syncFromStore() {
  const { level, name } = globalStore.scope;
  if (level === 'province') {
    selectedCity.value = '';
    selectedCounty.value = '';
  } else if (level === 'prefecture') {
    selectedCity.value = name;
    selectedCounty.value = '';
    hoveredCity.value = name;
  } else if (level === 'county') {
    selectedCounty.value = name;
    const parent = hierarchy.value.find(c => 
      c.children && (c.children.includes(name) || c.children.find(child => child.name === name))
    );
    if (parent) {
      selectedCity.value = parent.name;
      hoveredCity.value = parent.name;
    }
  }
}

/**
 * 切换选择面板的展开与收起状态
 */
function toggleExpanded() {
  if (globalStore.activePanel === panelName) {
    globalStore.setActivePanel(null);
  } else {
    globalStore.setActivePanel(panelName);
    nextTick(() => { searchInput.value?.focus(); });
  }
}

/**
 * 选择省级（默认重置为云南省全域）
 */
function onProvinceSelect() {
  globalStore.setScope('province', '530000', '云南省');
  selectedCity.value = '';
  selectedCounty.value = '';
  globalStore.setActivePanel(null);
}

/**
 * 选择地市级
 * @param {Object} city 城市数据对象
 */
function onCitySelect(city) {
  selectedCity.value = city.name;
  selectedCounty.value = '';
  globalStore.setScope('prefecture', city.code, city.name);
}

/**
 * 选择区县级
 * @param {Object|string} county 区县数据对象或区县名称
 */
function onCountySelect(county) {
  const cName = county.name || county;
  selectedCounty.value = cName;
  globalStore.setScope('county', county.code || '', cName);
  globalStore.setActivePanel(null);
}

/**
 * 点击搜索结果列表项的处理逻辑
 * @param {Object} res 搜索结果项
 */
function onResultClick(res) {
  if (res.level === 'prefecture') {
    onCitySelect(res);
  } else {
    selectedCity.value = res.parentCity;
    onCountySelect(res);
  }
}

/**
 * 搜索框敲击回车时，默认选择第一个搜索结果
 */
function handleSearchEnter() {
  if (searchResults.value.length > 0) {
    onResultClick(searchResults.value[0]);
  }
}

// 组件挂载时请求数据并监听全局状态变化进行同步
onMounted(fetchHierarchy);
watch(() => globalStore.scope, syncFromStore, { deep: true });
</script>

<style scoped>
.region-selector-trigger {
  position: relative;
  display: inline-block;
  pointer-events: auto;
}

/* 按钮样式：对齐 BottomNav，弱化发光 */
.region-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: radial-gradient(circle at 30% 30%, rgba(80, 110, 200, 0.5) 0%, rgba(30, 45, 90, 0.8) 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  position: relative;
}

.region-btn:hover {
  background: radial-gradient(circle at 30% 30%, rgba(100, 140, 255, 0.6) 0%, rgba(40, 60, 120, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.7);
  transform: translateY(-4px) scale(1.1);
}

.is-active .region-btn {
  background: rgba(59, 130, 246, 0.8);
  border-color: #fff;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
}

.icon-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  /* 移除局部 drop-shadow，改为由 BottomNav 全局接管，确保视觉统一 */
  transition: transform 0.3s ease;
}

.region-label {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(13, 25, 48, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 1px 8px;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
}

/* 选择面板：高度对齐 RegionCascader (540px) */
.selection-panel {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  width: 540px;
  background: rgba(13, 25, 48, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(24px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 3000;
  padding: 16px; /* 增加内边距对齐 Cascader */
  gap: 12px;
}

.panel-header {
  padding: 0;
  background: transparent;
  border-bottom: none;
}

.search-input-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.4);
}

.search-input-wrapper input {
  flex: 1;
  padding: 10px 12px 10px 36px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
  font-size: 13px;
  transition: all 0.3s;
}

.search-input-wrapper input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.1);
  border-color: #3b82f6;
}

.close-panel-btn {
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 18px;
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.close-panel-btn:hover {
  background: rgba(245, 108, 108, 0.2);
  color: #fff;
  transform: rotate(90deg) scale(1.1);
}

.close-panel-btn:active {
  transform: rotate(90deg) scale(0.95);
  opacity: 0.8;
}

.columns-container {
  display: flex;
  height: 320px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.column {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
}

.column-title {
  padding: 10px;
  font-size: 12px;
  color: #94a3b8;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  text-align: center;
}

.list-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.list-item {
  padding: 8px 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  margin-bottom: 2px;
  position: relative;
}

.list-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.list-item.active {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  font-weight: 700;
}

.list-item .arrow {
  position: absolute;
  right: 12px;
  opacity: 0.3;
}

.empty-hint {
  padding: 40px 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.2);
  font-size: 12px;
  font-style: italic;
}

.search-results {
  height: 320px;
  overflow-y: auto;
  padding: 8px;
}

.result-item {
  padding: 10px 16px;
  border-radius: 6px;
  margin-bottom: 4px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.02);
}

.result-item:hover {
  background: rgba(59, 130, 246, 0.15);
}

.res-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.res-path {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
}

.res-badge {
  padding: 1px 8px;
  background: rgba(59, 130, 246, 0.15);
  border-radius: 4px;
  color: #3b82f6;
  font-size: 10px;
}

.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }

.panel-slide-up-enter-active, .panel-slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
}

.panel-slide-up-enter-from, .panel-slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(15px);
}
</style>
