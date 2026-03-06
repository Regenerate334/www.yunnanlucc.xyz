<template>
    <div class="area-measure-control">
        <button @click="toggleMeasure" class="measure-btn" :class="{ active: isMeasuring }" title="测面积">
            <img src="../../assets/icons/cemianji.png" class="measure-icon" alt="测面积" />
            <span class="btn-label">测面积</span>
        </button>

        <!-- 右侧弹出结果面板 -->
        <transition name="slide-fade">
            <div v-if="globalStore.activePanel === 'area'" class="result-popover vibe-panel">
                <!-- 面板头部: 居中标题 + 关闭按钮 -->
                <div class="vibe-panel-header">
                    <h1 class="vibe-panel-title">测面结果</h1>
                    <button class="vibe-close-btn" @click="globalStore.setActivePanel(null)" title="关闭面板">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- 面板主体: 带蓝竖线的二级标题 + 内嵌深色卡片 -->
                <div class="vibe-panel-body">
                    <!-- 单位选择模块 -->
                    <div class="vibe-section">
                        <div class="vibe-section-label">显示单位</div>
                        <div class="vibe-inset-card unit-selector-card" ref="unitDropdownRef">
                            <div class="vibe-custom-select" @click.stop="toggleUnitDropdown">
                                <span class="selected-text">{{ unitLabels[areaUnit] }}</span>
                                <svg class="chevron" :class="{ open: isUnitDropdownOpen }" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none">
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </div>
                            <transition name="dropdown-fade">
                                <ul v-if="isUnitDropdownOpen" class="vibe-select-options">
                                    <li v-for="(label, value) in unitLabels" :key="value" 
                                        :class="{ active: areaUnit === value }" @click.stop="selectUnit(value)">
                                        {{ label }}
                                        <svg v-if="areaUnit === value" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none">
                                            <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                    </li>
                                </ul>
                            </transition>
                        </div>
                    </div>

                    <!-- 结果数值模块 -->
                    <div class="vibe-section">
                        <div class="vibe-section-label">面积</div>
                        <div class="vibe-inset-card data-card">
                            <span class="vibe-data-value">{{ formatArea(results.area) }}</span>
                        </div>
                    </div>

                    <div class="vibe-section">
                        <div class="vibe-section-label">周长</div>
                        <div class="vibe-inset-card data-card">
                            <span class="vibe-data-value">{{ formatDistance(results.perimeter) }}</span>
                        </div>
                    </div>
                </div>

                <!-- 面板底部: 全宽主按钮 -->
                <div class="vibe-panel-footer">
                    <button class="vibe-execute-btn vibe-warn" @click="clearMeasurement">
                        清除测量结果
                    </button>
                </div>
            </div>
        </transition>
    </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useMeasurement } from '../../composables/useMeasurement';
import { useGlobalStore } from '../../stores/global';

const globalStore = useGlobalStore();
const {
    activeTool,
    areaUnit,
    distanceUnit,
    results,
    activateTool,
    clearMeasurement,
    formatDistance,
    formatArea
} = useMeasurement();

// 监听全局面板状态，如果是 area 则激活测量工具，否则取消激活
watch(() => globalStore.activePanel, (newVal) => {
    if (newVal === 'area') {
        if (activeTool.value !== 'area') {
            activateTool('area');
        }
    } else if (activeTool.value === 'area') {
        activateTool(null);
    }
});

function toggleMeasure() {
    globalStore.setActivePanel('area');
}

const isUnitDropdownOpen = ref(false);
const unitDropdownRef = ref(null);

const unitLabels = {
    sq_meter: '平方米',
    sq_kilometer: '平方千米',
    sq_inch: '平方英寸',
    sq_foot: '平方英尺',
    sq_yard: '平方码',
    sq_mile: '平方英里',
    acre: '英亩',
    are: '公亩',
    hectare: '公顷'
};

function toggleUnitDropdown() {
    isUnitDropdownOpen.value = !isUnitDropdownOpen.value;
}

function selectUnit(value) {
    areaUnit.value = value;
    isUnitDropdownOpen.value = false;
}

function handleClickOutside(event) {
    if (unitDropdownRef.value && !unitDropdownRef.value.contains(event.target)) {
        isUnitDropdownOpen.value = false;
    }
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});

const isMeasuring = computed(() => globalStore.activePanel === 'area');
</script>

<style scoped>
/* 根容器不再需要 position: relative，以便子面板相对于主工具栏容器对齐 */

.measure-btn {
    width: 64px;
    height: 64px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(13, 25, 48, 0.4);
    backdrop-filter: blur(12px);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 2;
    color: #a5ccff;
}

.btn-label {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 600;
}

.measure-btn:hover {
    background: rgba(30, 58, 138, 0.6);
    border-color: rgba(59, 130, 246, 0.5);
    transform: translateY(-2px);
    color: #ffffff;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.measure-btn.active {
    background: #3B76E1 !important;
    border-color: #3B76E1;
    color: #ffffff;
    box-shadow: 0 4px 10px rgba(59, 118, 225, 0.3);
}

.measure-btn:active {
    transform: translateY(0);
}

.measure-icon {
    width: 28px;
    height: 28px;
    object-fit: contain;
    opacity: 0.8;
    transition: all 0.3s ease;
}

.measure-btn:hover .measure-icon {
    opacity: 1;
}

.measure-btn.active .measure-icon {
    opacity: 1;
}

/* 弹出面板基础结构 (Vibe Panel 规范) */
.vibe-panel {
    position: absolute;
    top: 0;
    left: 100%;
    margin-left: 20px;
    width: 260px;
    background: rgba(23, 35, 46, 0.85); /* 完全同步土地流转面板参数 */
    backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    box-shadow: 0 15px 45px rgba(0, 0, 0, 0.5);
    color: #E2E8F0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    /* 修复截断问题：移除 overflow: hidden 以允许下拉菜单溢出父容器 */
    overflow: visible; 
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* Header: 极限压缩高度 */
.vibe-panel-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 46px; /* 从 54px 压缩 */
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.vibe-panel-title {
    font-weight: 700;
    font-size: 17px;
    letter-spacing: 1.5px;
    color: #fff;
    margin: 0;
    text-shadow: 0 2px 10px rgba(0,0,0,0.3);
}

.vibe-close-btn {
    position: absolute;
    right: 16px; /* 对齐测流转面板 16px */
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.85); /* 恢复中性色 */
    cursor: pointer;
    padding: 6px;
    display: flex;
    transition: all 0.3s ease; /* 丝滑过渡 */
    border-radius: 50%;
}

.vibe-close-btn:hover {
    color: #F56C6C; /* 悬停变红 */
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-50%) rotate(90deg);
}

/* Body: 间距舒适的模块化布局 */
/* Body: 极限压缩间距 */
.vibe-panel-body {
    padding: 12px 16px; 
    display: flex;
    flex-direction: column;
    gap: 12px; 
}

/* 二级标题简洁化 */
.vibe-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.vibe-section-label {
    position: relative;
    font-size: 13px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.85);
    letter-spacing: 0.5px;
    padding-left: 12px;
    display: flex;
    align-items: center;
}

.vibe-section-label::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 13px;
    background: #3B76E1;
    border-radius: 2px;
    box-shadow: 0 0 8px rgba(59, 118, 225, 0.5);
}

/* 内嵌卡片: 极限尺寸压缩 */
.vibe-inset-card {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 6px 12px;
    transition: all 0.2s;
}

.vibe-inset-card.data-card {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
}

.vibe-data-value {
    font-size: 16px;
    font-weight: 700;
    color: #fff;
    font-family: 'Inter', system-ui, sans-serif;
    letter-spacing: 0.5px;
}

/* 下拉框深度定制 (Vibe Select) */
.unit-selector-card {
    position: relative;
    padding: 0;
}

.vibe-custom-select {
    padding: 10px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
}

.vibe-custom-select .selected-text {
    font-size: 14px;
    font-weight: 600;
}

.vibe-custom-select .chevron {
    color: #64748B;
    transition: transform 0.3s;
}

.vibe-custom-select .chevron.open {
    transform: rotate(180deg);
}

.vibe-select-options {
    position: absolute;
    top: calc(100% + 4px); /* 适应极致压缩后的间距 */
    left: 0;
    right: 0;
    background: rgba(23, 35, 46, 0.98);
    backdrop-filter: blur(15px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    margin: 0;
    padding: 6px;
    list-style: none;
    z-index: 2500; /* 确保层级高于一切，突破容器限制 */
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
    max-height: 180px;
    overflow-y: auto;
}

/* 统一暗色滚动条样式 */
.vibe-select-options::-webkit-scrollbar {
    width: 4px;
}

.vibe-select-options::-webkit-scrollbar-track {
    background: transparent;
}

.vibe-select-options::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
}

.vibe-select-options::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
}

.vibe-select-options li {
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 13px;
    color: #94A3B8;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.vibe-select-options li:hover {
    background: rgba(255, 255, 255, 0.08);
    color: white;
}

.vibe-select-options li.active {
    background: #3B76E1;
    color: white;
}

/* Footer 极限紧凑 */
.vibe-panel-footer {
    padding: 0 16px 12px;
}

.vibe-execute-btn {
    width: 100%;
    height: 44px;
    background: #3B76E1;
    border: none;
    border-radius: 12px;
    color: white;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 2px; /* 对齐流转面板的 2px */
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 4px 15px rgba(59, 118, 225, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
}

.vibe-execute-btn.vibe-warn {
    background: rgba(245, 108, 108, 0.1);
    border: 1px solid rgba(245, 108, 108, 0.3);
    color: #F56C6C;
    box-shadow: none;
}

.vibe-execute-btn.vibe-warn:hover {
    background: rgba(245, 108, 108, 0.2);
    border-color: rgba(245, 108, 108, 0.5);
    transform: translateY(-1px);
}

.vibe-execute-btn:hover {
    transform: translateY(-2px);
    filter: brightness(1.1);
}

.vibe-execute-btn:active {
    transform: translateY(0);
}

/* 进场动画修正 */
.slide-fade-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-fade-leave-active {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
    transform: translateX(-20px);
    opacity: 0;
}
</style>
