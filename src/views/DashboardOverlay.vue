<template>
    <div class="dashboard-overlay">
        <!-- 顶部 Header -->
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

        <!-- 左翼：监测与预警 -->
        <div class="dashboard-wing left-wing">
            <DashboardLeftPanel :year="year" />
        </div>

        <!-- 右翼：评估与洞察 -->
        <div class="dashboard-wing right-wing">
            <DashboardRightPanel :year="year" />
        </div>

        <!-- 底部装饰 -->
        <div class="dashboard-footer">
            <div class="footer-bar"></div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import DashboardLeftPanel from '../components/dashboard/DashboardLeftPanel.vue';
import DashboardRightPanel from '../components/dashboard/DashboardRightPanel.vue';
import WeatherWidget from '../components/ui/WeatherWidget.vue';

defineProps({
    year: { type: Number, default: 2023 }
});

const currentTime = ref('');
let timer = null;

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
    timer = setInterval(updateTime, 1000);
});

onUnmounted(() => {
    if (timer) clearInterval(timer);
});
</script>

<style scoped>
.dashboard-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2000;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.8) 90%);
    font-family: 'Microsoft YaHei', sans-serif;
    color: #fff;
}

.dashboard-header,
.dashboard-wing,
.dashboard-footer {
    pointer-events: auto;
}

/* Header */
.dashboard-header {
    height: 80px;
    background: linear-gradient(to bottom, #0f172a 0%, rgba(15, 23, 42, 0) 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
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

/* Wings */
.dashboard-wing {
    position: absolute;
    top: 90px;
    bottom: 40px;
    width: 25vw;
    display: flex;
    flex-direction: column;
    gap: 15px;
    padding: 0 10px;
}

.left-wing {
    left: 0;
    background: linear-gradient(to right, rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0));
}

.right-wing {
    right: 0;
    background: linear-gradient(to left, rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0));
}

/* Footer */
.dashboard-footer {
    height: 30px;
    background: linear-gradient(to top, #0f172a 0%, rgba(15, 23, 42, 0) 100%);
}
</style>
