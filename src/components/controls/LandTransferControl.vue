<template>
  <div class="land-transfer-control panel-card">
    <div class="panel-header">
      <div class="header-icon">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
          <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      </div>
      <span class="header-title">土地流转分析</span>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>

    <div class="control-body">
      <!-- 空间单元选择 -->
      <div class="control-row">
        <label>空间单元</label>
        <div class="unit-toggle">
          <button 
            :class="{ active: unit === 'county' }" 
            @click="unit = 'county'"
          >县级</button>
          <button 
            :class="{ active: unit === 'grid' }" 
            @click="unit = 'grid'"
          >格网</button>
        </div>
      </div>

      <!-- 时间选择 -->
      <div class="control-row">
        <label>时间区间</label>
        <div class="year-inputs">
          <input type="number" v-model.number="yearStart" :min="1985" :max="2022" class="year-input" />
          <span class="separator">-</span>
          <input type="number" v-model.number="yearEnd" :min="1986" :max="2023" class="year-input" />
        </div>
      </div>

      <!-- 地类流转 -->
      <div class="control-row transfer-flow">
        <div class="class-select-group">
          <label>转出 (From)</label>
          <select v-model="fromClass" class="class-select">
            <option v-for="opt in landClasses" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div class="arrow-icon">→</div>
        <div class="class-select-group">
          <label>转入 (To)</label>
          <select v-model="toClass" class="class-select">
            <option v-for="opt in landClasses" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>

      <!-- 执行按钮 -->
      <div class="action-buttons">
          <button class="run-btn primary" @click="handleQuery" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            <span v-else>生成流转图谱</span>
          </button>
          
          <button class="run-btn secondary" @click="$emit('reset')" title="清除分析结果并还原底图">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
      </div>
      
      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['close', 'transfer-query', 'reset']);

const unit = ref('county');
const yearStart = ref(1990);
const yearEnd = ref(2000);
const fromClass = ref(2); // Forest
const toClass = ref(7);   // Impervious
const loading = ref(false);
const errorMsg = ref('');

// 1-8 地类映射（灌木已合并到林地）
const landClasses = [
  { label: '耕地', value: 1 },
  { label: '林地', value: 2 },
  { label: '草地', value: 3 },
  { label: '水域', value: 4 },
  { label: '冰雪', value: 5 },
  { label: '裸地', value: 6 },
  { label: '建设用地', value: 7 },
  { label: '湿地', value: 8 },
];

const handleQuery = () => {
  if (yearStart.value >= yearEnd.value) {
    errorMsg.value = '起始年份必须小于结束年份';
    return;
  }
  if (fromClass.value === toClass.value) {
    errorMsg.value = '转出地类与转入地类不能相同';
    return;
  }
  
  errorMsg.value = '';
  loading.value = true;
  
  // 纯参数提交，由父组件 Workbench 驱动 WMS 加载
  emit('transfer-query', {
    yearStart: yearStart.value,
    yearEnd: yearEnd.value,
    fromClass: fromClass.value,
    toClass: toClass.value,
    unit: unit.value
  });
};

// 父组件加载完成后调用
const setLoading = (val) => {
  loading.value = val;
};

const setError = (msg) => {
  errorMsg.value = msg;
  loading.value = false;
};

defineExpose({ setLoading, setError });
</script>


<style scoped>
.land-transfer-control {
  position: fixed;
  top: 120px;
  right: 20px;
  width: 340px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 12px;
  color: white;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  transition: all 0.3s ease;
}

.panel-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-title {
  flex: 1;
  margin-left: 8px;
  font-weight: 600;
  font-size: 14px;
}

.close-btn {
  background: none;
  border: none;
  color: #aaa;
  font-size: 20px;
  cursor: pointer;
}
.close-btn:hover { color: white; }

.control-body {
  padding: 16px;
}

.control-row {
  margin-bottom: 16px;
}

.control-row label {
  display: block;
  font-size: 12px;
  color: #ccc;
  margin-bottom: 6px;
}

/* 空间单元 Toggle */
.unit-toggle {
  display: flex;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #444;
}

.unit-toggle button {
  flex: 1;
  padding: 6px 0;
  background: transparent;
  border: none;
  color: #999;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.unit-toggle button.active {
  background: linear-gradient(135deg, rgba(0, 229, 255, 0.25), rgba(41, 121, 255, 0.25));
  color: #00E5FF;
  font-weight: 600;
}

.unit-toggle button:hover:not(.active) {
  color: #ccc;
  background: rgba(255, 255, 255, 0.05);
}

.year-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.year-input {
  flex: 1;
  background: rgba(0,0,0,0.3);
  border: 1px solid #444;
  color: white;
  padding: 6px;
  border-radius: 4px;
  text-align: center;
}

.transfer-flow {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.class-select-group {
  flex: 1;
}

.class-select {
  width: 100%;
  background: rgba(0,0,0,0.3);
  border: 1px solid #444;
  color: white;
  padding: 6px;
  border-radius: 4px;
}

.arrow-icon {
  margin: 0 10px;
  color: #888;
  font-weight: bold;
  padding-top: 18px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.run-btn {
  background: linear-gradient(90deg, #00E5FF, #2979FF);
  border: none;
  padding: 10px;
  border-radius: 4px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.run-btn.primary {
  flex: 1;
}

.run-btn.secondary {
  width: 40px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.run-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

.run-btn:hover {
  opacity: 0.9;
}

.run-btn:disabled {
  background: #555;
  cursor: not-allowed;
}

.error-msg {
  color: #ff5252;
  font-size: 12px;
  margin-top: 8px;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
