<!--
  @component RegionCascader
  @description 行政区划级联选择器，支持云南省 16 个地州市及下属区县的三级联动
  @props modelValue ({ name, level }), placeholder, showLevelBadge
  @emits update:modelValue, change
  @dependencies regionApi (行政区划数据接口)
-->
<template>
  <div class="custom-region-dropdown" ref="dropdownRef">
    <div class="region-trigger" @click="toggleDropdown" :class="{ disabled: hierarchy.length === 0 }">
      <span class="selected-text">
        {{ modelValue.name || (hierarchy.length === 0 ? '正在加载...' : placeholder) }}
        <span v-if="modelValue.name && showLevelBadge" class="level-badge">{{ 
          modelValue.level === 'province' ? '省级' :
          modelValue.level === 'prefecture' ? '地级' : '县级' 
        }}</span>
      </span>
      <svg class="arrow" :class="{ open: isOpen }" viewBox="0 0 24 24" width="15" height="15">
        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"
          stroke-linejoin="round" />
      </svg>
    </div>

    <transition name="dropdown-fade">
      <div v-if="isOpen" class="region-options-panel">
        <div class="search-box">
          <input v-model="searchQuery" type="text" placeholder="搜索地州或区县..." @click.stop />
          <svg class="search-icon-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>

        <div class="selection-columns">
          <div class="selection-column">
            <div class="column-header">省直辖市</div>
            <div class="column-list">
              <div class="column-item" 
                :class="{ active: isSelected('云南省', 'province') }"
                @click="selectRegion('云南省', 'province')">
                云南省
              </div>
            </div>
          </div>

          <div class="selection-column">
            <div class="column-header">地级市州</div>
            <div class="column-list">
              <div v-for="pref in filteredHierarchy" :key="pref.name" class="column-item"
                :class="{ active: activePrefecture === pref.name || isSelected(pref.name, 'prefecture') }"
                @mouseenter="activePrefecture = pref.name" @click="selectRegion(pref.name, 'prefecture')">
                {{ pref.name }}
                <svg class="sub-arrow" viewBox="0 0 12 12" width="10" height="10">
                  <path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"
                    stroke-linejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          <div class="selection-column">
            <div class="column-header">区县旗</div>
            <div class="column-list">
              <template v-if="currentCounties.length > 0">
                <div v-for="county in currentCounties" :key="county" class="column-item"
                  :class="{ active: isSelected(county, 'county') }" @click="selectRegion(county, 'county')">
                  {{ county }}
                </div>
              </template>
              <div v-else class="empty-column-msg">
                请先选择地州市
              </div>
            </div>
          </div>
        </div>

        <div v-if="filteredHierarchy.length === 0 && searchQuery" class="no-results">
          未找到相关区域
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { regionApi } from '../../api/index.js';

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({ name: '', level: '' })
  },
  placeholder: {
    type: String,
    default: '请选择区域'
  },
  showLevelBadge: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['update:modelValue', 'change']);

const dropdownRef = ref(null);
const isOpen = ref(false);
const hierarchy = ref([]);
const searchQuery = ref('');
const activePrefecture = ref('');
const expandedPrefectures = ref(new Set());

// 过滤后的层级数据
const filteredHierarchy = computed(() => {
  if (!hierarchy.value) return [];
  if (!searchQuery.value || !searchQuery.value.trim()) return hierarchy.value;

  const query = searchQuery.value.trim().toLowerCase();
  const result = [];

  hierarchy.value.forEach(pref => {
    const prefMatch = pref.name.toLowerCase().includes(query);
    const matchingChildren = pref.children ? pref.children.filter(c => c.toLowerCase().includes(query)) : [];

    if (prefMatch || matchingChildren.length > 0) {
      result.push({
        name: pref.name,
        children: matchingChildren.length > 0 ? matchingChildren : pref.children
      });
    }
  });
  return result;
});

// 监听过滤结果，自动展开和定位
watch(filteredHierarchy, (newVal) => {
    if (searchQuery.value && newVal.length > 0) {
        // 1. 如果只有一个地州匹配，或某个地州下有匹配的县，自动选中第一个
        const firstMatch = newVal[0];
        if (firstMatch) {
            // 如果尚未选中或当前选中的不在结果中，则更新选中
            if (!activePrefecture.value || !newVal.find(p => p.name === activePrefecture.value)) {
                activePrefecture.value = firstMatch.name;
            }
            
            // 2. 尝试滚动到匹配的县
            // 需要在 DOM 更新后执行
            setTimeout(() => {
                const query = searchQuery.value.trim().toLowerCase();
                // 查找第一个匹配的县
                const matchedCounty = firstMatch.children.find(c => c.toLowerCase().includes(query));
                
                if (matchedCounty) {
                    // 找到对应的 DOM 元素
                    // 这里我们假设 county-item 有唯一的标识或文本内容
                    // 使用 document.evaluate 或 querySelectorAll 遍历
                    const items = document.querySelectorAll('.column-item');
                    for (const item of items) {
                        if (item.textContent.trim() === matchedCounty) {
                            item.scrollIntoView({ block: 'center', behavior: 'smooth' });
                            break;
                        }
                    }
                }
            }, 100);
        }
    }
});

// 当前显示的县级列表
const currentCounties = computed(() => {
  if (!activePrefecture.value) return [];
  // 注意：这里需要从 filteredHierarchy 中获取，以保持搜索结果的一致性
  if (searchQuery.value) {
      const pref = filteredHierarchy.value.find(p => p.name === activePrefecture.value);
      return pref ? pref.children : [];
  }
  
  const pref = hierarchy.value.find(p => p.name === activePrefecture.value);
  return pref ? pref.children : [];
});

async function fetchHierarchy() {
  try {
    const data = await regionApi.getRegionHierarchy();
    hierarchy.value = data;
    
    // 如果已有选中值，尝试定位
    if (props.modelValue && props.modelValue.name) {
       locateActivePrefecture();
    }
  } catch (e) {
    console.error('Failed to fetch region hierarchy:', e);
  }
}

function locateActivePrefecture() {
    if (!props.modelValue.name) return;
    
    // 如果选中的是地级市
    if (props.modelValue.level === 'prefecture') {
        activePrefecture.value = props.modelValue.name;
    } 
    // 如果选中的是县级，找到其父级地市
    else if (props.modelValue.level === 'county') {
        const parent = hierarchy.value.find(p => p.children && p.children.includes(props.modelValue.name));
        if (parent) {
            activePrefecture.value = parent.name;
        }
    }
}

function toggleDropdown() {
  if (hierarchy.value.length === 0) {
      fetchHierarchy(); // 确保数据加载
  }
  isOpen.value = !isOpen.value;
  if (!isOpen.value) {
    searchQuery.value = '';
  }
}

function isSelected(name, level) {
  return props.modelValue.name === name && props.modelValue.level === level;
}

function selectRegion(name, level) {
  const newValue = { 
      name, 
      level,
      parentName: level === 'county' ? activePrefecture.value : null 
  };
  emit('update:modelValue', newValue);
  emit('change', newValue);
  isOpen.value = false;
  
  // 更新 activePrefecture
  if (level === 'prefecture') {
      activePrefecture.value = name;
  }
}

function handleClickOutside(event) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    isOpen.value = false;
  }
}

watch(() => props.modelValue, () => {
    if (hierarchy.value.length > 0) {
        locateActivePrefecture();
    }
}, { deep: true });

onMounted(() => {
  fetchHierarchy();
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.custom-region-dropdown {
  position: relative;
  font-family: 'Inter', Microsoft YaHei, sans-serif;
}

.region-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  min-width: 140px;
  min-height: 22px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(12px);
}

.region-trigger:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.region-trigger.disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.selected-text {
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.level-badge {
  font-size: 11px;
  background: #3b82f6;
  padding: 1px 6px;
  border-radius: 4px;
  color: white;
  font-weight: 600;
  margin-left: 4px;
}

.arrow {
  color: #a5ccff;
  transition: transform 0.3s;
}

.arrow.open {
  transform: rotate(180deg);
}

.region-options-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 540px;
  max-height: 500px;
  background: rgba(13, 25, 48, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
  z-index: 1002;
  backdrop-filter: blur(24px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-box {
  position: relative;
  width: 100%;
}

.search-box input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
  font-size: 13px;
  transition: all 0.3s;
}

.search-box input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.1);
  border-color: #3b82f6;
}

.search-icon-svg {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.4);
}

.selection-columns {
  display: flex;
  height: 320px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.selection-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
}

.selection-column:last-child {
  border-right: none;
}

.column-header {
  padding: 10px;
  font-size: 12px;
  color: #94a3b8;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  text-align: center;
}

.column-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.column-list::-webkit-scrollbar {
  width: 4px;
}

.column-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}

.column-item {
  padding: 8px 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center; /* 改为居中 */
  transition: all 0.2s;
  margin-bottom: 2px;
  position: relative; /* 增加相对定位以容纳绝对定位箭头 */
}

.column-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: white;
}

.column-item.active {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  font-weight: 700;
}

.sub-arrow {
  color: rgba(255, 255, 255, 0.3);
  position: absolute;
  right: 12px;
}

.column-item.active .sub-arrow {
  color: #3b82f6;
}

.empty-column-msg {
  padding: 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
}

.no-results {
  text-align: center;
  padding: 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
