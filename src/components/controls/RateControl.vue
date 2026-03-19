<template>
    <div class="rate-control">
        <!-- 侧边栏入口按钮 -->
        <button @click="openModal" class="control-btn" :class="{ active: isVisible }" title="垦殖与转换率分析">
            <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
                <!-- 拼图式背景饼图，体现“统一图表风格” -->
                <circle cx="50" cy="50" r="45" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
                
                <!-- 扇形1: 耕地颜色 -->
                <path d="M50 50 L50 5 A45 45 0 0 1 95 50 Z" fill="#FAE39C" opacity="0.9"/>
                <!-- 扇形2: 林地颜色 -->
                <path d="M50 50 L95 50 A45 45 0 0 1 50 95 Z" fill="#446F33" opacity="0.9"/>
                <!-- 扇形3: 水域颜色 -->
                <path d="M50 50 L50 95 A45 45 0 0 1 5 50 Z" fill="#1E69B4" opacity="0.9"/>
                <!-- 扇形4: 建设用地颜色 -->
                <path d="M50 50 L5 50 A45 45 0 0 1 50 5 Z" fill="#E24290" opacity="0.9"/>

                <!-- 中心孔洞，形成环状/现代感 -->
                <circle cx="50" cy="50" r="18" fill="currentColor"/>
                
                <!-- 覆盖一个象征“率”的增长折线 -->
                <polyline points="35,65 45,55 55,60 70,45" 
                    stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"
                    style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5))" />
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
