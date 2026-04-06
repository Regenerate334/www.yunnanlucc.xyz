<template>
  <div class="region-selector-wrapper" :class="{ 'is-expanded': isExpanded }">
    <!-- 顶部状态栏 (作为主入口) -->
    <div class="status-bar floating-glass" @click="toggleExpanded">
      <div class="location-icon">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>
      <div class="current-path">
        <span class="path-segment">云南省</span>
        <template v-if="selectedCity">
          <svg class="separator" viewBox="0 0 24 24" width="12" height="12"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2.5" /></svg>
          <span class="path-segment highlight">{{ selectedCity }}</span>
        </template>
        <template v-if="selectedCounty">
          <svg class="separator" viewBox="0 0 24 24" width="12" height="12"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2.5" /></svg>
          <span class="path-segment highlight">{{ selectedCounty }}</span>
        </template>
      </div>
      <div class="expand-icon" :class="{ 'rotated': isExpanded }">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>

    <!-- 三栏级联选择面板 -->
    <transition name="panel-zoom">
      <div v-if="isExpanded" class="selection-panel floating-glass">
        <div class="panel-header">
           <div class="search-input-wrapper">
             <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
               <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
             </svg>
             <input 
               v-model="searchQuery" 
               type="text" 
               placeholder="搜索地州或区县..." 
               ref="searchInput"
               @keyup.enter="handleSearchEnter"
             />
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
                  <template v-if="currentCityObj">
                    <div 
                      v-for="county in currentCityObj.children" 
                      :key="county.code || county" 
                      class="list-item"
                      :class="{ active: selectedCounty === (county.name || county) }"
                      @click="onCountySelect(county)"
                    >
                      {{ county.name || county }}
                    </div>
                  </template>
                  <div v-else class="empty-hint">请先选择地市</div>
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

const globalStore = useGlobalStore();
const isExpanded = ref(false);
const searchQuery = ref('');
const hierarchy = ref([]);
const searchInput = ref(null);

const selectedCity = ref('');
const selectedCounty = ref('');

const currentCityObj = computed(() => {
  return hierarchy.value.find(c => c.name === selectedCity.value);
});

const searchResults = computed(() => {
  if (!searchQuery.value) return [];
  const query = searchQuery.value.toLowerCase();
  const results = [];

  hierarchy.value.forEach(city => {
    if (city.name.toLowerCase().includes(query)) {
      results.push({ name: city.name, code: city.code, level: 'prefecture', levelLabel: '地级', path: '云南省' });
    }
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

async function fetchHierarchy() {
  try {
    const data = await regionApi.getRegionHierarchy();
    hierarchy.value = data;
    syncFromStore();
  } catch (e) { console.error(e); }
}

function syncFromStore() {
  const { level, name } = globalStore.scope;
  if (level === 'province') {
    selectedCity.value = '';
    selectedCounty.value = '';
  } else if (level === 'prefecture') {
    selectedCity.value = name;
    selectedCounty.value = '';
  } else if (level === 'county') {
    selectedCounty.value = name;
    const parent = hierarchy.value.find(c => 
      c.children && (c.children.includes(name) || c.children.find(child => child.name === name))
    );
    if (parent) selectedCity.value = parent.name;
  }
}

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
  if (isExpanded.value) {
    nextTick(() => { searchInput.value?.focus(); });
  }
}

function onProvinceSelect() {
  globalStore.setScope('province', '530000', '云南省');
  selectedCity.value = '';
  selectedCounty.value = '';
  isExpanded.value = false;
}

function onCitySelect(city) {
  selectedCity.value = city.name;
  selectedCounty.value = '';
  globalStore.setScope('prefecture', city.code, city.name);
}

function onCountySelect(county) {
  const cName = county.name || county;
  selectedCounty.value = cName;
  globalStore.setScope('county', county.code || '', cName);
  isExpanded.value = false;
}

function onResultClick(res) {
  if (res.level === 'prefecture') {
    onCitySelect(res);
  } else {
    selectedCity.value = res.parentCity;
    onCountySelect(res);
  }
}

onMounted(fetchHierarchy);
watch(() => globalStore.scope, syncFromStore, { deep: true });
</script>

<style scoped>
.region-selector-wrapper {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 顶部状态栏 (玻璃黑) */
.status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border-radius: 10px;
  background: rgba(13, 25, 48, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
  cursor: pointer;
  transition: all 0.3s;
  min-width: 180px;
}

.status-bar:hover {
  background: rgba(20, 35, 65, 0.85);
  border-color: rgba(59, 130, 246, 0.5);
}

.current-path {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

.path-segment.highlight {
  color: #3b82f6;
  font-weight: 700;
}

.separator {
  opacity: 0.3;
}

.expand-icon {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.5;
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

/* 三栏选择面板 */
.selection-panel {
  width: 720px;
  background: rgba(13, 25, 48, 0.95);
  border-radius: 12px;
  border: 1px solid rgba(59, 130, 246, 0.4);
  box-shadow: 0 20px 80px rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(24px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.search-input-wrapper {
  position: relative;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.3);
}

.search-input-wrapper input {
  width: 100%;
  height: 40px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 0 16px 0 44px;
  color: white;
  font-size: 14px;
  transition: all 0.2s;
}

.search-input-wrapper input:focus {
  outline: none;
  border-color: #3b82f6;
  background: rgba(0, 0, 0, 0.5);
}

.columns-container {
  display: flex;
  height: 420px;
}

/* 栏目样式 */
.column {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
}

.column:last-child {
  border-right: none;
}

.column-title {
  padding: 12px 20px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.3);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(255, 255, 255, 0.01);
}

.list-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.list-item {
  padding: 10px 16px;
  margin-bottom: 2px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  transition: all 0.2s;
}

.list-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.list-item.active {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  font-weight: 700;
}

.list-item .arrow {
  opacity: 0.2;
}

.list-item:hover .arrow {
  opacity: 0.8;
}

.empty-hint {
  padding: 30px;
  text-align: center;
  color: rgba(255, 255, 255, 0.2);
  font-size: 13px;
}

/* 搜索结果 */
.search-results {
  height: 420px;
  overflow-y: auto;
  padding: 10px;
}

.result-item {
  padding: 14px 20px;
  border-radius: 8px;
  margin-bottom: 4px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.02);
  transition: all 0.2s;
}

.result-item:hover {
  background: rgba(59, 130, 246, 0.15);
}

.res-name {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 2px;
}

.res-path {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.res-badge {
  padding: 2px 8px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 4px;
  color: #3b82f6;
  font-size: 11px;
}

/* 滚动条 */
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(59, 130, 246, 0.4); }

/* 动画 */
.panel-zoom-enter-active, .panel-zoom-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.panel-zoom-enter-from, .panel-zoom-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}
</style>
