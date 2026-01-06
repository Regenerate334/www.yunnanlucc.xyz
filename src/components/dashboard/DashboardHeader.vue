<template>
    <div class="dashboard-header">
        <div class="header-left-content">
            <WeatherWidget />
        </div>
        <div class="header-deco-left"></div>
        <div class="header-title">
            <span class="main-title">云南省土地利用综合监测预警评估中心</span>
            <span class="sub-title">YUNNAN LAND USE MONITORING COMMAND CENTER</span>
        </div>
        <div class="header-deco-right"></div>
        <div class="header-time">{{ currentTime }}</div>
        <button class="close-btn" @click="$emit('close')">退出大屏</button>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import WeatherWidget from '../ui/WeatherWidget.vue';

defineEmits(['close']);

const currentTime = ref('');
let timeTimer = null;

function updateTime() {
    const now = new Date();
    currentTime.value = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

onMounted(() => {
    updateTime();
    timeTimer = setInterval(updateTime, 1000);
});

onUnmounted(() => {
    if (timeTimer) clearInterval(timeTimer);
});
</script>

<style scoped>
.dashboard-header {
    height: 80px;
    background: linear-gradient(to bottom, #0f172a 0%, rgba(15, 23, 42, 0) 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    pointer-events: auto;
}

.header-left-content {
    position: absolute;
    left: 20px;
    display: flex;
    align-items: center;
}

.header-title {
    text-align: center;
    display: flex;
    flex-direction: column;
    text-shadow: 0 0 10px rgba(59, 130, 246, 0.8);
}

.main-title {
    font-size: 32px;
    font-weight: bold;
    letter-spacing: 4px;
    background: linear-gradient(to right, #fff, #a5ccff);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
}

.sub-title {
    font-size: 10px;
    color: #64748b;
    letter-spacing: 2px;
    margin-top: 4px;
}

.header-time {
    position: absolute;
    right: 120px;
    font-family: 'Courier New', monospace;
    font-size: 18px;
    color: #a5ccff;
    font-weight: bold;
}

.close-btn {
    position: absolute;
    right: 20px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
    color: #ef4444;
    padding: 5px 15px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
}

.close-btn:hover {
    background: #ef4444;
    color: #fff;
}
</style>
