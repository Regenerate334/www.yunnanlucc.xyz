<!--
  @component AIAnalysisControl
  @description 智能分析助手入口，集成大模型分析能力，对当前地图视图或统计数据进行一键式专家解读
  @props 无
  @emits 无
  @dependencies AIAnalysisModal (弹窗组件), useGlobalStore (全局状态)
-->
<template>
  <div class="ai-analysis-control">
    <button @click="toggleAIAnalysis" class="ai-btn" :class="{ active: showAIModal }" title="AI 一键智能分析">
        <img :src="aiIcon" class="ai-icon" alt="AI" />
        <span class="btn-label">AI 分析</span>
    </button>

    <AIAnalysisModal 
      v-model:visible="showAIModal" 
      :year="selectedYear" 
      region="云南省" 
      analysis-type="comprehensive"
      :component-context="{ type: 'global_sidebar' }" 
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import aiIcon from '@/assets/icons/business/ai-analysis.png';
import AIAnalysisModal from '../ui/AIAnalysisModal.vue';
import { useGlobalStore } from '../../stores/global';

const globalStore = useGlobalStore();
const showAIModal = ref(false);

// 从全局状态或 props 获取当前年份，默认为 2023
const selectedYear = computed(() => {
  // 注入或通过 store 获取当前年份逻辑
  // 这里假设我们需要传递给 AI 当前业务年份
  return 2023; 
});

const toggleAIAnalysis = () => {
  showAIModal.value = !showAIModal.value;
};
</script>

<style scoped>
/* 根容器不再需要 position: relative，以便子面板相对于主工具栏容器对齐 */
.ai-btn {
  position: relative;
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
  color: #a5ccff;
  pointer-events: auto;
}

.ai-btn.active {
  background: #3B76E1 !important;
  border-color: #3B76E1;
  color: #ffffff;
  box-shadow: 0 4px 10px rgba(59, 118, 225, 0.3);
}

.btn-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  pointer-events: none;
}

.ai-btn:hover {
  background: rgba(30, 58, 138, 0.6);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.ai-btn:hover .ai-icon {
  transform: scale(1.1) rotate(5deg);
}

.ai-icon {
  width: 28px;
  height: 28px;
  transition: all 0.3s ease;
  pointer-events: none;
  filter: brightness(0) invert(1);
}

.ai-btn:active {
  transform: translateY(0);
}
</style>
