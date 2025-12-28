<template>
    <div class="relative flex h-screen w-screen items-center justify-center overflow-hidden">

        <!-- 背景层（本地图片） -->
        <div ref="bgRef"
            class="absolute inset-0 bg-cover bg-center transition-transform duration-500 ease-in-out group-hover:scale-105 will-change-transform"
            :style="{ backgroundImage: `url(${bgUrl})`, transform: `scale(${bgScale})`, transformOrigin: 'center center' }">
        </div>

        <!-- 背景装饰层：柔光渐变与网格线（呼应空间网格） -->
        <div class="pointer-events-none absolute inset-0">
            <div class="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl"></div>
            <div class="absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl"></div>
            <div class="absolute inset-0"
                style="background-image: linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px); background-size: 40px 40px;">
            </div>
        </div>

        <!-- 遮罩效果层 -->
        <div class="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/50 to-transparent"></div>

        <!-- 文字标题内容层 -->
        <div class="relative z-10 flex flex-col items-center text-center text-white px-4">
            <!-- 理论定位徽章 -->
            <div class="mb-5 flex flex-wrap items-center justify-center gap-2 text-xs md:text-sm">
                <span class="rounded-full bg-white/10 px-5 py-1 backdrop-blur-sm">理论导向</span>
                <span class="rounded-full bg-white/10 px-5 py-1 backdrop-blur-sm">指标体系与方法论</span>
                <span class="rounded-full bg-white/10 px-5 py-1 backdrop-blur-sm">规划决策支持</span>
            </div>
            <h1 class="mb-3 text-5xl font-bold tracking-wider text-shadow-md md:text-7xl">
                云南国土空间规划监测预警平台
            </h1>

            <p class="mb-10 max-w-3xl text-lg text-gray-200 text-shadow-md md:text-2xl">
                数据驱动决策，科技守护未来
            </p>

            <!-- 主操作按钮区 -->
            <div class="mb-10 flex flex-wrap items-center justify-center gap-4">
                <button @click="enterPlatform" @keyup.enter="enterPlatform" aria-label="进入平台"
                    class="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-blue-600 px-10 py-4 text-lg font-semibold text-white shadow-lg transition-all duration-300 ease-in-out hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50">
                    <span
                        class="absolute -inset-full top-0 block -translate-x-full transform bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-500 ease-in-out group-hover:translate-x-full"></span>
                    进入平台
                </button>
                <a href="https://cesium.com/learn/cesiumjs-learn/" target="_blank" rel="noreferrer"
                    class="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-8 py-4 text-lg font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/30">
                    了解Cesium
                </a>
            </div>

            <!-- 理论亮点：指标体系 / 预警方法 / 情景评估 -->
            <div class="mb-10 grid w-full max-w-4xl grid-cols-1 gap-4 px-2 md:grid-cols-3">
                <div
                    class="rounded-xl border border-white/10 bg-white/5 p-4 text-center shadow-sm backdrop-blur-md flex flex-col items-center">
                    <div class="mb-2 flex items-center gap-2 text-cyan-300">
                        <span class="font-semibold ">监测评估指标体系</span>
                    </div>
                    <p class="text-sm text-gray-200/90">分层分域建模，量化空间绩效</p>
                </div>
                <div
                    class="rounded-xl border border-white/10 bg-white/5 p-4 text-center shadow-sm backdrop-blur-md flex flex-col items-center">
                    <div class="mb-2 flex items-center gap-2 text-emerald-300">
                        <span class="font-semibold">预警触发与阈值机制</span>
                    </div>
                    <p class="text-sm text-gray-200/90">洞悉潜在风险，触发精准预警。</p>
                </div>
                <div
                    class="rounded-xl border border-white/10 bg-white/5 p-4 text-left shadow-sm backdrop-blur-md flex flex-col items-center">
                    <div class="mb-2 flex items-center gap-2 text-amber-300">
                        <span class="font-semibold">情景模拟与评估方法</span>
                    </div>
                    <p class="text-sm text-gray-200/90">推演多重情景，赋能科学决策</p>
                </div>
            </div>

            <!-- 统计卡片：理论对象/方法/产出 -->
            <div class="mb-6 grid w-full max-w-5xl grid-cols-3 gap-3 text-center">
                <div class="rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                    <div class="text-2xl font-bold">实施对象</div>
                    <div class="text-1xl text-white/80">聚焦三区三线，守护生态格局</div>
                </div>
                <div class="rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                    <div class="text-2xl font-bold">方法模型</div>
                    <div class="text-1xl text-white/80">AI驱动引擎，智慧报告图谱</div>
                </div>
                <div class="rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                    <div class="text-2xl font-bold">结果分析</div>
                    <div class="text-1xl text-white/80">预期产出（方案/论文/报告）</div>
                </div>
            </div>

            <small class="text-white/70">按 Enter 键可快速进入</small>

            <footer class="absolute -bottom-40 text-center text-md text-gray-400">
                <p>© 2025 彭派 | 云南国土空间规划监测预警平台</p>
            </footer>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import portalBg from '../assets/images/portal_bg.png';

const router = useRouter();
const bgScale = ref(1);

// 使用背景图片
const bgUrl = portalBg;

function enterPlatform() {
    router.push('/login');
}

function updateBgScale() {
    const vv = window.visualViewport;
    if (vv && typeof vv.scale === 'number') {
        bgScale.value = vv.scale || 1;
        return;
    }
    const dpr = window.devicePixelRatio || 1;
    bgScale.value = dpr;
}

function handleDprChange() {
    updateBgScale();
}

onMounted(() => {
    updateBgScale();
    if (window.matchMedia) {
        try {
            const mediaQueries = [
                '(resolution: 96dpi)',
                '(resolution: 120dpi)',
                '(resolution: 144dpi)',
                '(resolution: 192dpi)'
            ];
            mediaQueries.forEach(q => {
                const mq = window.matchMedia(q);
                mq.addEventListener?.('change', handleDprChange);
            });
        } catch (e) {
            window.addEventListener('resize', handleDprChange);
        }
    } else {
        window.addEventListener('resize', handleDprChange);
    }
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', handleDprChange);
});
</script>

<style scoped>
.text-shadow {
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.text-shadow-md {
    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.6);
}
</style>
