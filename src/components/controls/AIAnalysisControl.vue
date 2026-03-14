<template>
  <div class="ai-analysis-control">
    <button @click="openAIAnalysis" class="ai-btn" title="AI 一键智能分析">
       <ChatGptIcon :size="32" color="#ffffff" class="ai-icon" />
       <span class="btn-label">AI 分析</span>
    </button>

    <!-- AI 分析弹窗 -->
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
import ChatGptIcon from '../icons/ChatGptIcon.vue';
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

const openAIAnalysis = () => {
  showAIModal.value = true;
};
</script>

<style scoped>
.ai-analysis-control {
  position: relative;
}

.ai-btn {
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
}

.btn-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

.ai-btn:hover {
  background: rgba(30, 58, 138, 0.6);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.ai-btn:hover .ai-icon {
  transform: scale(1.1) rotate(5deg);
  filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.5));
}

.ai-icon {
  transition: all 0.3s ease;
}

.ai-btn:active {
  transform: translateY(0);
}
</style>
