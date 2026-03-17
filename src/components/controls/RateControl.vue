<template>
    <div class="rate-control">
        <!-- 侧边栏入口按钮 -->
        <button @click="openModal" class="control-btn" :class="{ active: isVisible }" title="垦殖与转换率分析">
            <!-- 图标：饼图+增长箭头，寓意率值 -->
            <svg width="28" height="28" viewBox="0 0 1024 1024" fill="none">
                <defs>
                    <linearGradient id="rateGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#34d399"/>
                        <stop offset="100%" stop-color="#f59e0b"/>
                    </linearGradient>
                </defs>
                <!-- 圆形底盘 -->
                <circle cx="480" cy="500" r="340" fill="url(#rateGradient)" opacity="0.25"/>
                <!-- 饼图扇形（约60%填充色） -->
                <path d="M480 500 L480 160 A340 340 0 1 1 134 680 Z" fill="url(#rateGradient)" opacity="0.85"/>
                <!-- 剩余扇形（轮廓） -->
                <path d="M480 500 L134 680 A340 340 0 0 1 480 160 Z" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="10"/>
                <!-- 右上角上升箭头 -->
                <polyline points="700,220 820,100 820,200 920,200 920,100 820,100" 
                    stroke="#ffffff" stroke-width="48" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
            <span class="btn-label">垦殖转换</span>
        </button>

        <Teleport to="body">
            <transition name="slide-fade">
                <LandRateControl
                    ref="innerControlRef"
                    v-if="isVisible"
                    @close="closeModal"
                    @rate-query="$emit('rate-query', $event)"
                    @reset="$emit('reset-map')"
                />
            </transition>
        </Teleport>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import LandRateControl from './LandRateControl.vue';
import { useGlobalStore } from '../../stores/global';

const globalStore = useGlobalStore();
const panelName = 'rate';

const emit = defineEmits(['rate-query', 'reset-map']);
const isVisible = computed(() => globalStore.activePanel === panelName);
const innerControlRef = ref(null);

function openModal() {
    globalStore.setActivePanel(panelName);
}

function closeModal() {
    globalStore.setActivePanel(null);
}

const setLoading = (val) => {
    if (innerControlRef.value) innerControlRef.value.setLoading(val);
};

const setError = (msg) => {
    if (innerControlRef.value) innerControlRef.value.setError(msg);
};

defineExpose({ setLoading, setError });
</script>

<style scoped>
.rate-control {
    position: relative;
}

.control-btn {
    width: 64px;
    height: 64px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(13, 25, 48, 0.4);
    backdrop-filter: blur(12px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    color: #a5ccff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    flex-direction: column;
    gap: 2px;
}

.control-btn.active {
    background: #3B76E1 !important;
    border-color: #3B76E1;
    color: #ffffff;
    box-shadow: 0 4px 10px rgba(59, 118, 225, 0.3);
}

.control-btn:hover {
    background: rgba(30, 58, 138, 0.6);
    border-color: rgba(59, 130, 246, 0.5);
    transform: translateY(-2px);
    color: #ffffff;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.control-btn:hover svg {
    transform: scale(1.1);
}

.control-btn svg {
    transition: transform 0.3s ease;
}

.btn-label {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 600;
}

/* 入场/离场动画 */
.slide-fade-enter-active {
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.slide-fade-leave-active {
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
    transform: translateX(-20px);
    opacity: 0;
}
</style>
