<!--
  系统门户/大屏视图 (Portal View)
  职责：作为系统入口，展示 3D 地球视觉动效及系统核心功能矩阵，引导用户进入业务工作台。
  
  修改提示：
  1. 3D 地球由 ECharts-GL 驱动，纹理素材位于 @/assets/images/ui/ 目录下。
  2. 底部功能卡片的文案修改需在模板的“核心内容区”直接编辑。
  3. 页面已适配自适应缩放，修改布局时请优先使用 Tailwind CSS 类名。
-->
<template>
    <div class="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-black select-none">

        <!-- 3D 地球背景层 (ECharts-GL) -->
        <div ref="chartRef" class="absolute inset-0 z-0"></div>

        <!-- 背景装饰层：柔光渐变 -->
        <div class="pointer-events-none absolute inset-0 z-1">
            <div class="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl"></div>
            <div class="absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl"></div>
        </div>

        <!-- 遮罩效果层：让 3D 地球从中心透出，边缘压暗聚焦 -->
        <div class="absolute inset-0 z-2 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] pointer-events-none"></div>

        <!-- [PRO MAX] 核心内容区 (整体下移) -->
        <div class="relative z-10 flex h-full flex-col items-center justify-start text-center text-white px-4 pt-44 md:pt-56">
            
            <!-- 极简抬头：更新英文全称 -->
            <div class="mb-6 flex items-center space-x-3 text-xs md:text-sm tracking-[0.2em] font-light text-white/40 uppercase">
                <span class="h-[1px] w-8 bg-gradient-to-r from-transparent to-blue-500/50"></span>
                <span>Yunnan Province Land Use Change Early Warning and Assessment System</span>
                <span class="h-[1px] w-8 bg-gradient-to-l from-transparent to-blue-500/50"></span>
            </div>
            
            <!-- 艺术化主标题：静态显示，无动画 -->
            <h1 class="mb-6 text-5xl font-extralight md:text-8xl leading-[1.3] text-white">
                <span class="inline-block tracking-[0.2em] transform hover:scale-[1.02] drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                    云南省土地利用变化
                </span><br/>
                <span class="font-bold tracking-[0.05em] text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 drop-shadow-[0_10px_30px_rgba(59,130,246,0.4)]">
                    监测预警评估系统
                </span>
            </h1>

            <!-- Slogan：缩减底部间距 -->
            <p class="mb-1 max-w-[60rem] text-lg md:text-2xl font-extralight tracking-[0.4em] text-cyan-50/60 drop-shadow-lg leading-relaxed">
                融合时空智能与动态可视，以数据穿透驱动精准治理
            </p>

            <!-- 移除中心操作矩阵，改为底部并列架构 -->
            
            <!-- [PRO MAX] 核心入口与观测阵列 (根据反馈下移位置) -->
            <div class="absolute bottom-28 left-0 right-0 px-8 flex flex-col items-center">
                
                <!-- 01: 登录按钮 (缩减下间距，紧凑布局) -->
                <div class="mb-12">
                    <button @click="enterPlatform" 
                        class="group relative flex h-14 w-64 items-center justify-center overflow-hidden rounded-full border border-blue-400/40 bg-blue-600/20 backdrop-blur-3xl hover:bg-blue-600/40 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                        <span class="text-xl font-bold tracking-[0.4em] text-white">登录系统</span>
                    </button>
                </div>

                <!-- 02: 5个精品功能标题 (增强明度与间距) -->
                <div class="w-[95vw] flex flex-wrap justify-between items-end gap-16">
                    
                    <!-- 1. 长序动态感知 -->
                    <div class="relative flex w-72 flex-col items-center justify-center">
                        <h3 class="text-xl font-bold tracking-[0.1em] text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 drop-shadow-[0_4px_12px_rgba(59,130,246,0.5)] cursor-default">长序动态感知</h3>
                        <p class="mt-3 text-sm leading-relaxed tracking-wide text-white/80 text-center">
                            穿透 35 年时序演进脉络，高频感知全域地类动态变化，构建时空连续的土地利用演化知识图谱。
                        </p>
                    </div>

                    <!-- 2. 多维格网解构 -->
                    <div class="relative flex w-72 flex-col items-center justify-center">
                        <h3 class="text-xl font-bold tracking-[0.1em] text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 drop-shadow-[0_4px_12px_rgba(59,130,246,0.5)] cursor-default">多维格网解构</h3>
                        <p class="mt-3 text-sm leading-relaxed tracking-wide text-white/80 text-center">
                            贯通省-市-县级维度，解构地类构成的空间异质性，实现精细化格网单元下的多尺度空间关联建模。
                        </p>
                    </div>

                    <!-- 3. 大模型语义解析 -->
                    <div class="relative flex w-72 flex-col items-center justify-center">
                        <h3 class="text-xl font-bold tracking-[0.1em] text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 drop-shadow-[0_4px_12px_rgba(59,130,246,0.5)] cursor-default">大模型语义解析</h3>
                        <p class="mt-3 text-sm leading-relaxed tracking-wide text-white/80 text-center">
                            融合 LLM 语义识别与行业知识库，驱动海量非结构化数据向智慧决策的敏捷转化与深度知识提取。
                        </p>
                    </div>

                    <!-- 4. 全景专题制图 -->
                    <div class="relative flex w-72 flex-col items-center justify-center">
                        <h3 class="text-xl font-bold tracking-[0.1em] text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 drop-shadow-[0_4px_12px_rgba(59,130,246,0.5)] cursor-default">全景专题制图</h3>
                        <p class="mt-3 text-sm leading-relaxed tracking-wide text-white/80 text-center">
                            敏捷生成多因子耦合专题图件，直观勾勒土地资源要素全案画像，支撑高精度空间可视化。
                        </p>
                    </div>

                    <!-- 5. 精准预警评估 -->
                    <div class="relative flex w-72 flex-col items-center justify-center">
                        <h3 class="text-xl font-bold tracking-[0.1em] text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 drop-shadow-[0_4px_12px_rgba(59,130,246,0.5)] cursor-default">精准预警评估</h3>
                        <p class="mt-3 text-sm leading-relaxed tracking-wide text-white/80 text-center">
                            动态识别红线底线风险，自动生成分级预警报告，为国土空间规划与生态保护提供决策支撑。
                        </p>
                    </div>




                </div>
            </div>
        </div>

        <footer class="absolute bottom-10 w-full text-center text-xs tracking-widest text-white/60 z-10 transition-opacity hover:opacity-100">
            <p>© 昆明理工大学国土资源工程学院 彭派GIS课题组</p>
        </footer>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import 'echarts-gl';

// 导入本地素材
import earthTexture from '@/assets/images/ui/earth.jpg';
import starfieldTexture from '@/assets/images/ui/starfield.jpg';

const router = useRouter();
const chartRef = ref(null);
let myChart = null;

function initChart() {
    if (!chartRef.value) return;
    
    myChart = echarts.init(chartRef.value);
    
    const option = {
        backgroundColor: '#000',
        globe: {
            // 使用导入的本地资源
            baseTexture: earthTexture,
            shading: 'color', // 改为 color 模式，消除阴影面，保持全球明亮
            environment: starfieldTexture,
            atmosphere: {
                show: true,
                offset: 5,
                color: '#88aaff',
                intensity: 0.8
            },
            viewControl: {
                autoRotate: true,
                autoRotateSpeed: 3, // 调慢旋转速度，更具稳重感
                autoRotateAfterStill: 15,
                distance: 180, // 拉近距离，让地球更大更清晰
                damping: 0.8
            }
        },
        series: []
    };

    myChart.setOption(option);
}

function handleResize() {
    myChart?.resize();
}

function enterPlatform() {
    router.push('/login');
}

function handleEnterKey(e) {
    if (e.key === 'Enter') enterPlatform();
}

onMounted(() => {
    initChart();
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleEnterKey);
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('keydown', handleEnterKey);
    if (myChart) {
        myChart.dispose();
    }
});
</script>

<style scoped>
/* 极简无动画模式 */

@keyframes slideUp {
    from { opacity: 0; transform: translateY(50px); }
    to { opacity: 1; transform: translateY(0); }
}
/* 保持背景与文字交互的层次感 */
</style>
