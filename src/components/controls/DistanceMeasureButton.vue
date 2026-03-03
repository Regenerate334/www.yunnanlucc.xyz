<template>
    <div class="distance-measure-control">
        <button @click="toggleMeasure" class="measure-btn" :class="{ active: isMeasuring }" title="测距">
            <img src="../../assets/icons/ceju.png" class="measure-icon" alt="测距" />
            <span class="btn-label">测距</span>
        </button>

        <!-- 右侧弹出结果面板 -->
        <transition name="slide-fade">
            <div v-if="activeTool === 'distance'" class="result-popover">
                <div class="popover-header">
                    <span class="popover-title">测距结果</span>
                    <div class="custom-unit-dropdown" ref="unitDropdownRef">
                        <div class="unit-trigger" @click="toggleUnitDropdown">
                            <span>{{ unitLabels[distanceUnit] }}</span>
                            <svg class="arrow" :class="{ open: isUnitDropdownOpen }" viewBox="0 0 12 12" width="12" height="12">
                                <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <transition name="dropdown-fade">
                            <div v-if="isUnitDropdownOpen" class="unit-options">
                                <div v-for="(label, value) in unitLabels" :key="value" class="unit-option"
                                    :class="{ active: distanceUnit === value }" @click="selectUnit(value)">
                                    {{ label }}
                                </div>
                            </div>
                        </transition>
                    </div>
                </div>
                <div class="popover-content">
                    <div class="result-item">
                        <span class="label">直线距离</span>
                        <span class="value">{{ formatDistance(results.straight) }}</span>
                    </div>
                    <div class="result-item">
                        <span class="label">水平距离</span>
                        <span class="value">{{ formatDistance(results.horizontal) }}</span>
                    </div>
                    <div class="result-item">
                        <span class="label">垂直高度</span>
                        <span class="value">{{ formatDistance(results.vertical) }}</span>
                    </div>
                </div>
                <div class="popover-footer">
                    <button class="clear-btn" @click="clearMeasurement">清除</button>
                </div>
            </div>
        </transition>
    </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useMeasurement } from '../../composables/useMeasurement';

const {
    activeTool,
    distanceUnit,
    results,
    activateTool,
    clearMeasurement,
    formatDistance
} = useMeasurement();

function toggleMeasure() {
    if (activeTool.value === 'distance') {
        activateTool(null);
    } else {
        activateTool('distance');
    }
}

const isUnitDropdownOpen = ref(false);
const unitDropdownRef = ref(null);

const unitLabels = {
    meter: '米',
    kilometer: '公里',
    inch: '英寸',
    foot: '英尺',
    yard: '码',
    mile: '英里',
    nautical_mile: '海里'
};

function toggleUnitDropdown() {
    isUnitDropdownOpen.value = !isUnitDropdownOpen.value;
}

function selectUnit(value) {
    distanceUnit.value = value;
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

const isMeasuring = computed(() => activeTool.value === 'distance');
</script>

<style scoped>
.distance-measure-control {
    position: relative;
}

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
    background: #3b82f6;
    border-color: #60a5fa;
    color: #ffffff;
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
}

.measure-btn:active {
    transform: translateY(0);
}

.measure-icon {
    width: 32px;
    height: 32px;
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

/* 弹出面板样式 */
.result-popover {
    position: absolute;
    top: 50%; /* Center vertically */
    left: 100%; /* Right of button */
    margin-left: 16px; /* Gap */
    transform: translateY(-50%);
    width: 220px; /* Slightly increased to fit wider dropdown */
    background: rgba(13, 25, 48, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    backdrop-filter: blur(20px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    color: #fff;
    z-index: 1000;
}

.popover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px; /* Reduced padding */
    background: transparent; /* Removed dark background */
    border-bottom: 1px solid rgba(255, 255, 255, 0.08); /* Fainter border */
    border-radius: 12px 12px 0 0;
}

.popover-title {
    font-size: 14px; /* Slightly larger */
    font-weight: 600;
    color: #fff; /* White instead of blue-ish */
}

/* Dropdown Styles - Synced with AreaMeasureButton */
.custom-unit-dropdown {
    position: relative;
    pointer-events: auto;
    width: 110px; /* Fixed width */
}

.unit-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: #fff;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%; /* Fill container */
    justify-content: space-between;
}

.unit-trigger:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.25);
}

.arrow {
    font-size: 10px;
    color: #a5ccff;
    transition: transform 0.3s;
}

.arrow.open {
    transform: rotate(180deg);
}

.unit-options {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 100%; /* Match trigger width */
    background: rgba(13, 25, 48, 0.7); /* Match parent glass style */
    border: 1px solid rgba(255, 255, 255, 0.08); /* Match parent border */
    border-radius: 8px;
    padding: 4px;
    z-index: 1001;
    backdrop-filter: blur(20px); /* Match parent blur */
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    max-height: 200px;
    overflow-y: auto;
}

/* Custom Scrollbar */
.unit-options::-webkit-scrollbar {
    width: 4px;
}

.unit-options::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
}

.unit-option {
    padding: 10px 12px; /* Comfortable padding */
    color: rgba(255, 255, 255, 0.8);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    border-radius: 6px;
    text-align: left;
    white-space: nowrap;
}

.unit-option:hover {
    background: rgba(59, 130, 246, 0.15);
    color: #fff;
}

.unit-option.active {
    background: rgba(59, 130, 246, 0.25);
    color: #3b82f6;
    font-weight: 600;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
    transition: all 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}

.popover-content {
    padding: 20px 16px; 
    display: flex;
    flex-direction: column;
    gap: 16px; 
    overflow: visible; /* Ensure dropdown can overflow */
}

.result-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.result-item .label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.6);
}

.popover-footer {
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    text-align: right;
    background: transparent; /* Removed dark background */
    border-radius: 0 0 12px 12px;
}

.clear-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #a5ccff;
    font-size: 12px;
    padding: 6px 16px;
    cursor: pointer;
    transition: all 0.2s;
}

.clear-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fca5a5;
}

/* 动画 */
.slide-fade-enter-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-leave-active {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
    transform: translateY(-50%) translateX(-20px);
    opacity: 0;
}
</style>
