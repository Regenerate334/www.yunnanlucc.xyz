<!-- LandTransferControl: 土地流转分析面板，用于展示不同地类间的流转规模与趋势 -->
<!--
  @component LandTransferControl
  @description 土地利用转移分析控制面板，支持双年份对比选择、地类流向统计及桑基图联动
  @props 无
  @emits close (关闭面板)
  @dependencies useGlobalStore, clcdApi
-->
<template>
  <div class="land-transfer-control panel-card" ref="containerRef">
    <div class="panel-header">
      <h1 class="header-title">土地流转动态监测</h1>
      <button class="close-btn" @click="$emit('close')" title="关闭面板">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="control-body">
      <div class="control-section">
        <div class="section-label">空间统计单元</div>
        <div class="segmented-control">
          <button 
            :class="{ active: unit === 'county' }" 
            @click.stop="unit = 'county'"
          >县级区域</button>
          <button 
            :class="{ active: unit === 'grid' }" 
            @click.stop="unit = 'grid'"
          >空间格网</button>
        </div>
      </div>

      <!-- 监测时段选择 -->
      <div class="control-section">
        <div class="section-label">监测时段</div>
        <div class="year-range-picker">
          <div class="range-field">
            <span class="field-tag">起始年份</span>
            <input type="number" v-model.lazy.number="yearStart" />
          </div>
          <div class="range-divider">
            <div class="divider-line"></div>
          </div>
          <div class="range-field">
            <span class="field-tag">截止年份</span>
            <input type="number" v-model.lazy.number="yearEnd" />
          </div>
        </div>
      </div>

      <!-- 流转方向 -->
      <div class="control-section">
        <div class="section-label">流转方向</div>
        <div class="transfer-box">
          <div class="select-wrapper custom-select" :class="{ open: fromOpen }">
            <span class="select-hint">转出</span>
            <div class="select-trigger" @click.stop="toggleDropdown('from')">
              <span class="selected-text">{{ landClasses.find(c => c.value === fromClass)?.label }}</span>
              <svg class="chevron" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="1.8" fill="none">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            <transition name="dropdown-fade">
              <ul v-if="fromOpen" class="select-options">
                <li 
                  v-for="opt in landClasses" 
                  :key="opt.value" 
                  :class="{ active: fromClass === opt.value }"
                  @click="selectOption('from', opt.value)"
                >
                  {{ opt.label }}
                  <svg v-if="fromClass === opt.value" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="1.8" fill="none">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </li>
              </ul>
            </transition>
          </div>

          <div class="swap-btn-container" @click.stop="swapLandTypes" title="点击互换方向">
            <div class="swap-btn" :style="{ transform: `rotate(${rotateDeg}deg)` }">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" stroke-width="1.8">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" fill="rgba(255,255,255,0.05)"/>
                <path d="M8 12h8m-3-3l3 3-3 3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>

          <div class="select-wrapper custom-select" :class="{ open: toOpen }">
            <span class="select-hint">转入</span>
            <div class="select-trigger" @click.stop="toggleDropdown('to')">
              <span class="selected-text">{{ landClasses.find(c => c.value === toClass)?.label }}</span>
              <svg class="chevron" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="1.8" fill="none">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            <transition name="dropdown-fade">
              <ul v-if="toOpen" class="select-options">
                <li 
                  v-for="opt in landClasses" 
                  :key="opt.value" 
                  :class="{ active: toClass === opt.value }"
                  @click="selectOption('to', opt.value)"
                >
                  {{ opt.label }}
                  <svg v-if="toClass === opt.value" viewBox="0 0 24 24" width="7" height="7" stroke="currentColor" stroke-width="1.2" fill="none">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </li>
              </ul>
            </transition>
          </div>
        </div>
      </div>

      <!-- 执行按钮 -->
      <div class="footer-actions">
          <button class="reset-btn-ghost" @click.stop="$emit('reset')" title="重置图层数据">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            重置
          </button>
          <button class="execute-btn" @click.stop="handleQuery" :disabled="loading">
            <span v-if="loading" class="spinner-small"></span>
            <span v-if="loading" style="margin-left: 6px;">正在处理...</span>
            <span v-else>开始分析</span>
          </button>
      </div>
      
      <transition name="err-fade">
        <div v-if="errorMsg" class="validation-error">{{ errorMsg }}</div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useGlobalStore } from '../../stores/global.ts';

const emit = defineEmits(['close', 'transfer-query', 'reset']);

const containerRef = ref(null);
const globalStore = useGlobalStore();
const MIN_YEAR = 1985;
const MAX_YEAR = 2023;

const unit = ref('county');
const yearStart = ref(1985);
const yearEnd = ref(1990);
const fromClass = ref(1); // 耕地
const toClass = ref(2);   // 林地
const loading = ref(false);
const errorMsg = ref('');
const fromOpen = ref(false);
const toOpen = ref(false);
const rotateDeg = ref(0);

const availableYears = computed(() => globalStore.yearsAll);

const reactSnap = (newVal, oldVal, updateFn) => {
  const years = availableYears.value;
  if (!years.includes(newVal)) {
    const diff = newVal - oldVal;
    if (Math.abs(diff) === 1) {
      if (diff > 0) {
        const target = years.find(y => y > oldVal) || years[years.length - 1];
        nextTick(() => updateFn(target));
      } else {
        const target = [...years].reverse().find(y => y < oldVal) || years[0];
        nextTick(() => updateFn(target));
      }
    } else {
      const target = years.reduce((prev, curr) => 
        Math.abs(curr - newVal) < Math.abs(prev - newVal) ? curr : prev
      );
      nextTick(() => updateFn(target));
    }
  }
};

watch(yearStart, (nv, ov) => reactSnap(nv, ov, v => { yearStart.value = v; validateYear(); }));
watch(yearEnd, (nv, ov) => reactSnap(nv, ov, v => { yearEnd.value = v; validateYear(); }));

const swapLandTypes = () => {
  const temp = fromClass.value;
  fromClass.value = toClass.value;
  toClass.value = temp;
  rotateDeg.value += 360;
};

const toggleDropdown = (type) => {
  if (type === 'from') {
    fromOpen.value = !fromOpen.value;
    toOpen.value = false;
  } else {
    toOpen.value = !toOpen.value;
    fromOpen.value = false;
  }
};

const selectOption = (type, val) => {
  if (type === 'from') {
    fromClass.value = val;
    fromOpen.value = false;
  } else {
    toClass.value = val;
    toOpen.value = false;
  }
};

const validateYear = () => {
  if (yearStart.value < MIN_YEAR) yearStart.value = MIN_YEAR;
  if (yearStart.value > MAX_YEAR) yearStart.value = MAX_YEAR;
  if (yearEnd.value < MIN_YEAR) yearEnd.value = MIN_YEAR;
  if (yearEnd.value > MAX_YEAR) yearEnd.value = MAX_YEAR;

  // 交叉校验：起始不可大于截止
  if (yearStart.value > yearEnd.value) {
    yearStart.value = yearEnd.value;
  }
};

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

const dynamicTitle = computed(() => {
  const fromName = landClasses.find(c => c.value === fromClass.value)?.label || '';
  const toName = landClasses.find(c => c.value === toClass.value)?.label || '';
  return `${yearStart.value}-${yearEnd.value}年${fromName}转为${toName}面积(km²)`;
});

const handleQuery = () => {
  if (yearStart.value >= yearEnd.value) {
    errorMsg.value = '起始年份必须小于结束年份';
    return;
  }
  if (fromClass.value === toClass.value) {
    errorMsg.value = '地类不能相同';
    return;
  }
  errorMsg.value = '';
  loading.value = true;
  
  // 状态自动接管：切换至专门的流转分析态
  globalStore.setActiveLayer('land_transfer');

  emit('transfer-query', {
    yearStart: yearStart.value,
    yearEnd: yearEnd.value,
    fromClass: fromClass.value,
    toClass: toClass.value,
    unit: unit.value,
    legendTitle: dynamicTitle.value
  });
};

const handleClickOutside = (event) => {
  const path = event.composedPath();
  const isInside = containerRef.value && path.includes(containerRef.value);
  const isTrigger = path.some(el => el.classList && el.classList.contains('transfer-matrix-control'));
  
  if (!isInside && !isTrigger) {
    emit('close');
  }
  
  // Close dropdowns if clicking outside the custom select boxes
  if (!path.some(el => el.classList && el.classList.contains('custom-select'))) {
    fromOpen.value = false;
    toOpen.value = false;
  }
};

onMounted(() => {
  setTimeout(() => window.addEventListener('click', handleClickOutside), 0);
});

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside);
  // 不要在这里回滚！流转图层应当持久保留，直到用户主动在下拉框中选择其它基础图层。
});

const setLoading = (val) => { loading.value = val; };
const setError = (msg) => {
  errorMsg.value = msg;
  loading.value = false;
};

defineExpose({ setLoading, setError });
</script>

<style scoped>
.land-transfer-control {
  position: absolute;
  bottom: calc(100% + 15px); /* 置于按钮上方 15px */
  left: 50%;
  transform: translateX(-50%);
  width: 360px;
  background: rgba(30, 45, 90, 0.95);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  color: #E2E8F0;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  overflow: visible;
}

/* 气泡尖角 */
.land-transfer-control::after {
  content: '';
  position: absolute;
  bottom: -6px; 
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 12px;
  height: 12px;
  background: inherit; 
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  z-index: -1; 
}

.panel-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 43px; /* 极致压缩 */
  background: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-title {
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 1.5px;
  color: #fff;
  margin: 0;
  text-shadow: 0 2px 10px rgba(0,0,0,0.5);
}

.close-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  width: 32px; 
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 50%;
}

.close-btn:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-50%) rotate(90deg);
}

.control-body {
  padding: 14px 16px; 
  display: flex;
  flex-direction: column;
  gap: 12px; 
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-section:not(:first-child) {
  margin-top: 8px;
}

.section-label {
  position: relative;
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-left: 10px;
  display: flex;
  align-items: center;
}

.section-label::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2px; /* 极细装饰条 */
  height: 12px;
  background: #3B76E1;
  border-radius: 1px;
}

.segmented-control {
  display: flex;
  background: rgba(0, 0, 0, 0.25);
  padding: 4px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.segmented-control button {
  flex: 1;
  padding: 6px 0;
  background: transparent;
  border: none;
  color: #94A3B8;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 7px;
  font-family: inherit;
  transition: all 0.3s;
}

.segmented-control button.active {
  background: #3B76E1;
  color: white;
  box-shadow: 0 4px 12px rgba(59, 118, 225, 0.3);
}

.year-range-picker {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 6px 10px; 
}

.range-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.field-tag {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.65);
  font-weight: 500;
  letter-spacing: 0.5px;
  text-align: center;
}

.range-field input {
  width: 100%;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  font-family: inherit;
  outline: none;
}

.range-field input[type="number"]::-webkit-inner-spin-button,
.range-field input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.range-field input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}

.range-divider {
  padding: 0 12px;
}

.divider-line {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
}

.transfer-box {
  display: flex;
  align-items: center;
  gap: 10px;
}

.select-wrapper {
  flex: 1;
  position: relative;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 6px 12px;
  transition: all 0.3s;
}

.select-wrapper:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
}

.select-wrapper.open {
  border-color: #3B76E1;
  background: rgba(59, 118, 225, 0.05);
  box-shadow: 0 0 0 2px rgba(59, 118, 225, 0.2);
}

.select-hint {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  font-weight: 500;
  margin-bottom: 4px;
  letter-spacing: 1px;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  min-height: 20px;
}

.selected-text {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.chevron {
  width: 15px;
  height: 15px;
  color: rgba(255, 255, 255, 0.4);
  transition: transform 0.3s;
}

.open .chevron {
  transform: rotate(180deg);
  color: #3B76E1;
}

.select-options {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  background: rgba(30, 40, 50, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  margin: 0;
  padding: 6px;
  list-style: none;
  z-index: 2100;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  max-height: 220px;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 自定义滚动条样式 */
.select-options::-webkit-scrollbar {
  width: 4px;
}

.select-options::-webkit-scrollbar-track {
  background: transparent;
}

.select-options::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

.select-options::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.select-options li {
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #94A3B8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s;
}

.select-options li:hover {
  background: rgba(255, 255, 255, 0.08);
  color: white;
}

.select-options li.active { background: rgba(59, 118, 225, 0.15); color: #3B76E1; font-weight: 700; }
.select-options li svg {
  width: 15px;
  height: 15px;
}

.dropdown-fade-enter-active, .dropdown-fade-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.dropdown-fade-enter-from, .dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.transfer-arrow {
  display: flex;
  align-items: center;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 8px; 
  margin-top: 4px;
}

.execute-btn {
  flex: 1;
  height: 36px; /* 从 40px 压缩 */
  background: linear-gradient(to bottom, #4a85ee, #3B76E1); /* 增加微妙深度 */
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600; /* 减重 */
  font-size: 13px;
  letter-spacing: 1px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(59, 118, 225, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.execute-btn::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(120deg, transparent, rgba(255,255,255,0.1), transparent);
  transition: all 0.5s;
}

.execute-btn:hover::after {
  left: 100%;
}

.execute-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.swap-btn-container {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 4px;
  transition: all 0.3s ease;
  z-index: 10;
}

.swap-btn {
  backdrop-filter: blur(8px);
  background: rgba(255, 255, 255, 0.05); /* 磨砂玻璃质感 */
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.swap-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.execute-btn:disabled {
  background: #334155;
  box-shadow: none;
  cursor: not-allowed;
  opacity: 0.6;
}

.reset-btn-ghost {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  height: 36px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
}

.reset-btn-ghost:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
  color: white;
  transform: translateY(-1px);
}

.reset-btn-ghost:active {
  transform: translateY(0);
}

.validation-error {
  color: #FB7185;
  font-size: 12px;
  text-align: center;
  padding: 8px;
  background: rgba(225, 29, 72, 0.1);
  border-radius: 8px;
}

.spinner-small {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.err-fade-enter-active, .err-fade-leave-active {
  transition: all 0.3s ease;
}
.err-fade-enter-from, .err-fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
