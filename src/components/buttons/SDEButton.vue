<!-- SDEButton: 标准差椭圆入口组件 -->
<template>
    <div class="spatial-stats-entry">
        <button @click="toggleModal" class="control-btn sde-btn-trigger" :class="{ active: isModeActive || isVisible }" title="标准差椭圆分析">
            <img :src="sdeIcon" class="stats-icon" alt="图标" />
            <span class="btn-label">标准差椭圆</span>
        </button>

        <transition name="bubble-pop">
            <SDEControl
                v-show="isVisible"
                :visible="isVisible"
                ref="innerControlRef"
                @close="closeModal"
                @stats-query="$emit('stats-query', $event)"
                @reset="$emit('reset-map')"
            />
        </transition>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import sdeIcon from '../../assets/icons/business/standard_deviational_ellipse.png';
import SDEControl from '../controls/SDEControl.vue';
import { useGlobalStore } from '../../stores/global';

const globalStore = useGlobalStore();
const panelName = 'sde';

const emit = defineEmits(['stats-query', 'reset-map']);
const isVisible = computed(() => globalStore.activePanel === panelName);
const isModeActive = computed(() => {
    if (globalStore.activeTheme !== 'spatial_stats') return false;
    const params = globalStore.themeContext?.spatial_stats?.params;
    if (!params) return true;
    const showTrajectory = params.showTrajectory !== false;
    const showSDE = params.showSDE !== false;
    if (showTrajectory && showSDE) return true;
    return showSDE && !showTrajectory;
});
const innerControlRef = ref(null);

function toggleModal() {
    if (globalStore.activePanel === panelName) {
        globalStore.setActivePanel(null);
    } else {
        globalStore.setActivePanel(panelName);
    }
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
.control-btn {
    position: relative;
    width: 64px; height: 64px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(13, 25, 48, 0.4); backdrop-filter: blur(12px); cursor: pointer;
    display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 2px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); color: #a5ccff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    pointer-events: auto;
}
.control-btn.active {
    background: #3B76E1 !important; border-color: #3B76E1; color: #ffffff;
    box-shadow: 0 4px 10px rgba(59, 118, 225, 0.3);
}
.control-btn:hover {
    background: rgba(59, 118, 225, 0.6); border-color: rgba(59, 118, 225, 0.5);
    transform: translateY(-2px); color: #ffffff; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}
.control-btn .stats-icon {
    width: 28px;
    height: 28px;
    transition: transform 0.3s ease;
    pointer-events: none;
    filter: brightness(0) invert(1);
}
.control-btn:hover .stats-icon { transform: scale(1.1); }
.btn-label { font-size: 10px; color: rgba(255, 255, 255, 0.9); font-weight: 600; pointer-events: none; }
.bubble-pop-enter-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.bubble-pop-leave-active { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
.bubble-pop-enter-from, .bubble-pop-leave-to { transform: translate(-50%, 20px) scale(0.9);    opacity: 0; }
</style>
