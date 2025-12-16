<template>
  <!-- 年份选择器主容器 -->
  <div class="year-range-selector" :style="{ width: width + 'px' }">
    <!-- 主按钮：显示当前选中年份或默认提示文本，点击切换弹出面板 -->
    <div class="display-button" ref="buttonRef" :class="{ active: showPopover }" @click="togglePopover">
      <!-- 日历图标 -->
      <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      <!-- 按钮文本：根据用户是否选择过年份显示不同内容 -->
      <span class="button-text">{{ buttonText }}</span>
    </div>

    <!-- 弹出面板：年份选择器的主要交互区域 -->
    <div v-if="showPopover" class="popover-panel" ref="popoverRef">
      <!-- 面板头部：十年导航区域 -->
      <div class="popover-header">
        <!-- 左箭头按钮：切换到上一页 -->
        <button class="nav-button" @click="navigatePage(-1)" :disabled="currentPage === 0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"></polyline>
          </svg>
        </button>
        
        <!-- 当前页面年份范围显示 -->
        <span class="decade-range">{{ pageRangeText }}</span>
        
        <!-- 右箭头按钮：切换到下一页 -->
        <button class="nav-button" @click="navigatePage(1)" :disabled="currentPage >= totalPages - 1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"></polyline>
          </svg>
        </button>
      </div>

      <!-- 年份网格：4列布局显示当前页面的年份 -->
      <div class="year-grid">
        <div 
          v-for="year in paginatedYears" 
          :key="year"
          class="year-item"
          :class="{ selected: isYearSelected(year) }"
          @click="selectYear(year)"
        >
          {{ year }}
        </div>
      </div>
    </div>

    <!-- 背景遮罩：点击外部区域关闭弹出面板 -->
    <div v-if="showPopover" class="backdrop" @click="closePopover"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGlobalStore } from '../../store/index.js'

// ==================== 组件属性定义 ====================
interface Props {
  selectedYear?: number | null  // 当前选中的年份，null表示未选择
  width?: number               // 组件宽度
}

// 设置默认属性值
const props = withDefaults(defineProps<Props>(), {
  selectedYear: null,
  width: 200  // 调整为更窄的宽度
})

// 定义组件事件：当用户选择年份时触发
const emit = defineEmits<{
  'update:selectedYear': [value: number | null]
}>()

// ==================== 状态管理 ====================
const store = useGlobalStore()
const yearsAll = computed(() => store.yearsAll)  // 从store获取所有可用年份

// ==================== 组件状态变量 ====================
const showPopover = ref(false)                    // 控制弹出面板显示/隐藏
const currentPage = ref(0)                       // 当前显示的页面索引
const pageSize = 12                              // 每页显示的年份数量（4列×3行）
const popoverRef = ref<HTMLElement>()            // 弹出面板的DOM引用
const buttonRef = ref<HTMLElement>()             // 按钮的DOM引用
const hasUserSelected = ref(false)               // 关键状态：用户是否已经主动选择过年份

// ==================== 计算属性 ====================

// 总页数：根据年份总数和每页数量计算
const totalPages = computed(() => Math.ceil(yearsAll.value.length / pageSize))

// 当前页面的年份数组：分页显示年份
const paginatedYears = computed(() => {
  const startIndex = currentPage.value * pageSize
  return yearsAll.value.slice(startIndex, startIndex + pageSize)
})

// 页面范围文本：显示当前页面的年份范围
const pageRangeText = computed(() => {
  const firstYear = paginatedYears.value[0]
  const lastYear = paginatedYears.value[paginatedYears.value.length - 1]
  if (!firstYear || !lastYear) return ''
  return `${firstYear}年 - ${lastYear}年`
})

// 按钮显示文本：核心逻辑 - 根据用户选择状态显示不同内容
const buttonText = computed(() => {
  // 只有当用户主动选择过年份且确实有选中年份时，才显示年份信息
  if (props.selectedYear && hasUserSelected.value) {
    return `${props.selectedYear}年云南土地利用`
  }
  // 否则始终显示默认提示文本
  return '请选择图层年份'
})

// ==================== 核心方法 ====================

// 关闭弹出面板
const closePopover = () => {
  showPopover.value = false
}

// 切换弹出面板：处理按钮点击，支持打开和关闭
const togglePopover = () => {
  showPopover.value = !showPopover.value;

  // 如果面板正在打开，计算应该显示哪一页
  if (showPopover.value) {
    if (props.selectedYear) {
      // 如果已有选中年份，定位到该年份所在的页面
      const targetIndex = yearsAll.value.indexOf(props.selectedYear);
      if (targetIndex !== -1) {
        currentPage.value = Math.floor(targetIndex / pageSize);
      }
    } else {
      // 如果没有选中年份，默认显示第一页
      currentPage.value = 0;
    }
  }
}

// 页面导航：切换到上一页或下一页
const navigatePage = (direction: number) => {
  const newPage = currentPage.value + direction
  if (newPage >= 0 && newPage < totalPages.value) {
    currentPage.value = newPage
  }
}

// 选择年份：核心方法 - 处理用户点击年份
const selectYear = (year: number) => {
  console.log('YearRangeSelector: 选择年份', year);
  
  // 关键：标记用户已经主动选择过年份，这将改变按钮显示逻辑
  hasUserSelected.value = true;
  
  // 向父组件发送年份选择事件
  // 父组件需要使用 v-model:selectedYear="yourDataProperty" 来接收更新
  emit('update:selectedYear', year)
  console.log('YearRangeSelector: 已触发update:selectedYear事件');
  
  // 选择完成后关闭面板
  closePopover()
}

// 检查年份是否被选中：用于高亮显示当前选中的年份
const isYearSelected = (year: number) => {
  return year === props.selectedYear
}

// ==================== 事件处理 ====================

// 处理点击外部区域关闭弹出面板
const handleClickOutside = (event: MouseEvent) => {
  // 如果点击的是按钮本身，不关闭面板（由togglePopover处理）
  if (buttonRef.value && buttonRef.value.contains(event.target as Node)) {
    return
  }
  // 如果点击的是面板外部区域，关闭面板
  if (showPopover.value && popoverRef.value && !popoverRef.value.contains(event.target as Node)) {
    closePopover()
  }
}

// ==================== 生命周期钩子 ====================

onMounted(() => {
  // 添加全局点击监听，用于检测点击外部区域
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  // 组件卸载时移除事件监听，避免内存泄漏
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* ==================== 年份选择器样式 ==================== */

/* 主容器：相对定位，用于弹出面板的绝对定位 */
.year-range-selector {
  position: relative;
  display: inline-block;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.display-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(42, 61, 110, 0.85); /* 使用新的RGB颜色(42, 61, 110)，85%透明度 */
  border: 1px solid rgba(255, 255, 255, 0.12); /* 与图例边框色保持一致 */
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  backdrop-filter: blur(8px); /* 与图例毛玻璃效果保持一致 */
}
.display-button:hover {
  border-color: rgba(255, 255, 255, 0.3); /* 悬停时边框稍微亮一些 */
  background: rgba(42, 61, 110, 0.95); /* 悬停时背景更加不透明 */
}
.display-button.active {
  border-color: #9cc9ff; /* 使用图例标题色作为激活状态 */
  box-shadow: 0 0 0 3px rgba(156, 201, 255, 0.2); /* 使用图例标题色的透明版本 */
}
.icon {
  color: #ffffff; /* 使用纯白色 */
}
.button-text {
  font-size: 13px;
  font-weight: 500;
  color: #ffffff; /* 使用纯白色 */
}
.popover-panel {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: rgba(42, 61, 110, 0.85); /* 使用新的RGB颜色(42, 61, 110)，85%透明度 */
  border: 1px solid rgba(255, 255, 255, 0.12); /* 与图例边框色保持一致 */
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  margin-top: 4px;
  backdrop-filter: blur(8px); /* 与图例毛玻璃效果保持一致 */
}
.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12); /* 使用图例边框色 */
  background: rgba(42, 61, 110, 0.95); /* 头部背景更加不透明 */
  border-radius: 6px 6px 0 0;
}
.nav-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.1); /* 使用半透明白色背景 */
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #ffffff; /* 使用纯白色 */
}
.nav-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2); /* 悬停时背景稍微亮一些 */
  color: #ffffff; /* 悬停时保持纯白色 */
}
.nav-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.decade-range {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff; /* 使用纯白色 */
}
.year-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 12px 16px;
}
.year-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #ffffff; /* 使用纯白色 */
  transition: all 0.2s ease;
  user-select: none;
  border: 1px solid rgba(255, 255, 255, 0.1); /* 添加边框，与图例项保持一致 */
}
.year-item:hover {
  background: rgba(255, 255, 255, 0.1); /* 悬停时使用半透明白色背景 */
  border-color: rgba(255, 255, 255, 0.3); /* 悬停时边框稍微亮一些 */
}
.year-item.selected {
  background: rgba(156, 201, 255, 0.2); /* 使用图例标题色的透明版本作为选中背景 */
  color: #ffffff; /* 选中时使用纯白色 */
  font-weight: 600;
  border-color: #9cc9ff; /* 选中时边框使用图例标题色 */
}
.backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 999;
}
</style>
