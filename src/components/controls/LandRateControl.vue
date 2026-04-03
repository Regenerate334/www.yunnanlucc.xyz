<!-- LandRateControl: 土地利用分析面板，支持时段选择、流转方向定制及空间尺度设置 -->
<!--
  @component LandRateControl
  @description 复垦率/未利用地率分析控制面板，支持地类筛选、阈值设定及实时空间统计
  @props 无
  @emits close (关闭面板)
  @dependencies useGlobalStore, clcdApi
-->
<template>
  <div class="land-rate-control panel-card" ref="containerRef">
    <div class="panel-header">
      <h1 class="header-title">垦殖与转换率分析</h1>
      <button class="close-btn" @click="$emit('close')" title="关闭面板">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="control-body">
      <div class="control-section">
        <div class="section-label">分析模式</div>
        <div class="mode-selector">
          <button :class="{ active: mode === 'reclamation' }" @click.stop="mode = 'reclamation'">垦殖率</button>
          <button :class="{ active: mode === 'conversion'  }" @click.stop="mode = 'conversion'">转换率强度</button>
        </div>
      </div>

      <!-- 垦殖率：选择年份 -->
      <template v-if="mode === 'reclamation'">
        <div class="control-section">
          <div class="section-label">分析年份</div>
          <div class="year-range-picker solo">
            <div class="range-field">
              <span class="field-tag">年份</span>
              <input type="number" v-model.lazy.number="reclamYear" />
            </div>
          </div>
        </div>
      </template>

      <!-- 转换率：选时段 + 流转方向 -->
      <template v-if="mode === 'conversion'">
        <div class="control-section">
          <div class="section-label">监测时段</div>
          <div class="year-range-picker">
            <div class="range-field">
              <span class="field-tag">起始年份</span>
              <input type="number" v-model.lazy.number="convYearStart" />
            </div>
            <div class="range-divider">
              <div class="divider-line"></div>
            </div>
            <div class="range-field">
              <span class="field-tag">截止年份</span>
              <input type="number" v-model.lazy.number="convYearEnd" />
            </div>
          </div>
        </div>

        <div class="control-section">
          <div class="section-label">流转方向</div>
          <div class="transfer-box">
            <!-- 转出下拉 -->
            <div class="select-wrapper custom-select" :class="{ open: fromOpen }">
              <span class="select-hint">转出</span>
              <div class="select-trigger" @click.stop="toggleDropdown('from')">
                <span class="selected-text">{{ fromClass === null ? '全部' : landClasses.find(c => c.value === fromClass)?.label }}</span>
                <svg class="chevron" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="1.8" fill="none">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
              <transition name="dropdown-fade">
                <ul v-if="fromOpen" class="select-options">
                  <li :class="{ active: fromClass === null }" @click="selectOption('from', null)">
                    全部
                    <svg v-if="fromClass === null" viewBox="0 0 24 24" width="7" height="7" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M20 6L9 17l-5-5"/></svg>
                  </li>
                  <li v-for="opt in landClasses" :key="opt.value" :class="{ active: fromClass === opt.value }" @click="selectOption('from', opt.value)">
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
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="1.2">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" fill="rgba(255,255,255,0.05)"/>
                  <path d="M8 12h8m-3-3l3 3-3 3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>

            <!-- 转入下拉 -->
            <div class="select-wrapper custom-select" :class="{ open: toOpen }">
              <span class="select-hint">转入</span>
              <div class="select-trigger" @click.stop="toggleDropdown('to')">
                <span class="selected-text">{{ toClass === null ? '全部' : landClasses.find(c => c.value === toClass)?.label }}</span>
                <svg class="chevron" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="1.8" fill="none">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
              <transition name="dropdown-fade">
                <ul v-if="toOpen" class="select-options">
                  <li :class="{ active: toClass === null }" @click="selectOption('to', null)">
                    全部
                    <svg v-if="toClass === null" viewBox="0 0 24 24" width="7" height="7" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M20 6L9 17l-5-5"/></svg>
                  </li>
                  <li v-for="opt in landClasses" :key="opt.value" :class="{ active: toClass === opt.value }" @click="selectOption('to', opt.value)">
                    {{ opt.label }}
                    <svg v-if="toClass === opt.value" viewBox="0 0 24 24" width="7" height="7" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M20 6L9 17l-5-5"/></svg>
                  </li>
                </ul>
              </transition>
            </div>
          </div>
        </div>
      </template>

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
          <span v-if="loading" style="margin-left: 6px;">正在计算...</span>
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
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { useGlobalStore } from '../../stores/global';

const globalStore = useGlobalStore();
const emit = defineEmits(['close', 'rate-query', 'reset']);

const containerRef = ref(null);
const availableYears = computed(() => globalStore.yearsAll);

const mode          = ref('reclamation');
const reclamYear    = ref(1985);
const convYearStart = ref(1985);
const convYearEnd   = ref(2023);
const fromClass     = ref(1);   // 耕地
const toClass       = ref(2);   // 林地

const loading       = ref(false);
const errorMsg      = ref('');
const fromOpen      = ref(false);
const toOpen        = ref(false);
const rotateDeg     = ref(0);

const reactSnap = (newVal, oldVal, updateFn) => {
  const years = availableYears.value;
  if (!years.includes(newVal)) {
    // 只有当新值偏离旧值且偏离了1（通常是点击箭头或滚动）时，才采用跳跃逻辑
    // 否则直接计算最近年份
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
      // 用于手动输入，如果是输入 1987，吸附到 1985 或 1990
      const target = years.reduce((prev, curr) => 
        Math.abs(curr - newVal) < Math.abs(prev - newVal) ? curr : prev
      );
      nextTick(() => updateFn(target));
    }
  }
};

watch(reclamYear, (nv, ov) => reactSnap(nv, ov, v => reclamYear.value = v));
watch(convYearStart, (nv, ov) => reactSnap(nv, ov, v => { convYearStart.value = v; validateYear(); }));
watch(convYearEnd, (nv, ov) => reactSnap(nv, ov, v => { convYearEnd.value = v; validateYear(); }));

const landClasses = [
  { label: '耕地',   value: 1 },
  { label: '林地',   value: 2 },
  { label: '灌木',   value: 3 },
  { label: '草地',   value: 4 },
  { label: '水域',   value: 5 },
  { label: '湿地',   value: 6 },
  { label: '建设用地', value: 7 },
  { label: '裸地',   value: 8 },
  { label: '冰雪',   value: 9 },
];

const swapLandTypes = () => {
  const temp = fromClass.value;
  fromClass.value = toClass.value;
  toClass.value = temp;
  rotateDeg.value += 360;
};

const toggleDropdown = (type) => {
  if (type === 'from') { fromOpen.value = !fromOpen.value; toOpen.value = false; }
  else                 { toOpen.value   = !toOpen.value;   fromOpen.value = false; }
};

const selectOption = (type, val) => {
  if (type === 'from') { fromClass.value = val; fromOpen.value = false; }
  else                 { toClass.value   = val; toOpen.value   = false; }
};

const validateReclamYear = () => {
  // Select handles bounds
};

const validateYear = () => {
  if (convYearStart.value >= convYearEnd.value) {
    const startIndex = availableYears.value.indexOf(convYearEnd.value);
    convYearStart.value = availableYears.value[Math.max(0, startIndex - 1)];
  }
};

const handleQuery = () => {
  errorMsg.value = '';
  if (mode.value === 'reclamation') {
    loading.value = true;
    emit('rate-query', {
      attribute:   'reclamation',
      year:        reclamYear.value,
      unit:        'county',
      legendTitle: `${reclamYear.value}年垦殖率(%)`
    });
  } else {
    if (convYearStart.value >= convYearEnd.value) {
      errorMsg.value = '起始年份必须小于截止年份';
      return;
    }
    loading.value = true;
    const fromLabel = fromClass.value === null ? '各地类' : (landClasses.find(c => c.value === fromClass.value)?.label || '');
    const toLabel   = toClass.value   === null ? '各地类' : (landClasses.find(c => c.value === toClass.value)?.label   || '');
    emit('rate-query', {
      attribute:   'conversion',
      year:        convYearEnd.value,
      year_start:  convYearStart.value,
      year_end:    convYearEnd.value,
      from_class:  fromClass.value !== null ? fromClass.value : '',
      to_class:    toClass.value   !== null ? toClass.value   : '',
      unit:        'county',
      legendTitle: `${convYearStart.value}-${convYearEnd.value}年\n${fromLabel}转${toLabel}强度(%)`
    });
  }
};

const handleClickOutside = (event) => {
  const path = event.composedPath();
  const isInside  = containerRef.value && path.includes(containerRef.value);
  const isTrigger = path.some(el => el.classList && el.classList.contains('rate-control'));
  if (!isInside && !isTrigger) emit('close');
  if (!path.some(el => el.classList && el.classList.contains('custom-select'))) {
    fromOpen.value = false;
    toOpen.value   = false;
  }
};

onMounted  (() => { setTimeout(() => window.addEventListener('click', handleClickOutside), 0); });
onUnmounted(() => { window.removeEventListener('click', handleClickOutside); });

const setLoading = (val) => { loading.value = val; };
const setError   = (msg) => { errorMsg.value = msg; loading.value = false; };
defineExpose({ setLoading, setError });
</script>

<style scoped>
.land-rate-control {
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
.land-rate-control::after {
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
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}

.close-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(245, 108, 108, 0.15); /* 默认开启半透明红 */
  border: none;
  color: #F56C6C; /* 默认红色 */
  cursor: pointer;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  border-radius: 50%;
}
.close-btn:hover {
  background: rgba(245, 108, 108, 0.25);
  color: #fff;
  transform: translateY(-50%) rotate(90deg) scale(1.1);
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
.control-section:not(:first-child) { margin-top: 8px; }

.section-label {
  position: relative;
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
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
  width: 2px;
  height: 12px;
  background: #3B76E1;
  border-radius: 1px;
}

.mode-selector {
  display: flex;
  background: rgba(0, 0, 0, 0.25);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.mode-selector button {
  flex: 1;
  padding: 8px 0;
  background: transparent;
  border: none;
  color: #94A3B8;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 9px;
  font-family: inherit;
  transition: all 0.3s;
}
.mode-selector button.active {
  background: #3B76E1;
  color: white;
  box-shadow: 0 4px 12px rgba(59, 118, 225, 0.3);
}

.year-range-picker {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 12px;
}
.year-range-picker.solo { justify-content: center; }

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
  color: rgba(255, 255, 255, 0.95);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  font-family: inherit;
  outline: none;
}
.range-field input[type="number"]::-webkit-inner-spin-button,
.range-field input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.range-field input[type="number"] { -moz-appearance: textfield; appearance: textfield; }

.range-divider { padding: 0 12px; }
.divider-line { width: 1px; height: 20px; background: rgba(255, 255, 255, 0.1); }

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
.select-wrapper:hover { border-color: rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.06); }
.select-wrapper.open { border-color: #3B76E1; background: rgba(59, 118, 225, 0.05); box-shadow: 0 0 0 2px rgba(59, 118, 225, 0.2); }

.select-hint { display: block; font-size: 12px; color: rgba(255, 255, 255, 0.7); font-weight: 500; margin-bottom: 2px; letter-spacing: 1px; }
.select-trigger { display: flex; align-items: center; justify-content: space-between; cursor: pointer; min-height: 20px; }
.selected-text { font-size: 13px; font-weight: 600; color: rgba(255, 255, 255, 0.9); }
.chevron {
  width: 15px;
  height: 15px;
  color: rgba(255, 255, 255, 0.4);
  transition: transform 0.3s;
}
.open .chevron { transform: rotate(180deg); color: #3B76E1; }

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
}
.select-options::-webkit-scrollbar { width: 4px; }
.select-options::-webkit-scrollbar-track { background: transparent; }
.select-options::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
.select-options li { padding: 10px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; color: #94A3B8; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.2s; }
.select-options li:hover { background: rgba(255,255,255,0.08); color: white; }
.select-options li.active { background: rgba(59, 118, 225, 0.15); color: #3B76E1; font-weight: 700; }
.select-options li svg {
  width: 15px;
  height: 15px;
}

.dropdown-fade-enter-active, .dropdown-fade-leave-active { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.dropdown-fade-enter-from, .dropdown-fade-leave-to { opacity: 0; transform: translateY(10px); }

.swap-btn-container { display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 4px; border-radius: 50%; transition: all 0.3s ease; z-index: 10; }
.swap-btn-container:hover { filter: brightness(1.1); transform: scale(1.15); }
.swap-btn { display: flex; align-items: center; justify-content: center; transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }

/* 年份选择器增强 */
.dual-year-select {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.select-wrapper.small {
  padding: 4px 10px;
}

.select-wrapper.small .selected-text {
  font-size: 13px;
}

.year-select {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}

.footer-actions { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.execute-btn {
  flex: 1;
  height: 36px;
  background: linear-gradient(to bottom, #4a85ee, #3B76E1);
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600;
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
  top: 0; left: -100%; width: 100%; height: 100%;
  background: linear-gradient(120deg, transparent, rgba(255,255,255,0.1), transparent);
  transition: all 0.5s;
}

.execute-btn:hover::after { left: 100%; }
.execute-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.1); }
.execute-btn:disabled { background: #334155; box-shadow: none; cursor: not-allowed; opacity: 0.6; }

.validation-error { color: #FB7185; font-size: 12px; text-align: center; padding: 8px; background: rgba(225, 29, 72, 0.1); border-radius: 8px; }

.reset-btn-ghost {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  height: 36px;
  background: rgba(245, 108, 108, 0.1); /* 参考测量工具“清除”样式 */
  border: 1px solid rgba(245, 108, 108, 0.3);
  border-radius: 8px;
  color: #F56C6C;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
}

.reset-btn-ghost:hover {
  background: rgba(245, 108, 108, 0.2);
  border-color: rgba(245, 108, 108, 0.5);
  color: #F56C6C;
  transform: translateY(-1px);
}

.reset-btn-ghost:active {
  transform: translateY(0);
}

.spinner-small { display: inline-block; width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: white; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.err-fade-enter-active, .err-fade-leave-active { transition: all 0.3s ease; }
.err-fade-enter-from, .err-fade-leave-to { opacity: 0; transform: translateY(-5px); }
</style>
