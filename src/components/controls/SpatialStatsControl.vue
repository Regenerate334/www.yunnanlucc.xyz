<!-- SpatialStatsControl: 空间轨迹与标准差椭圆分析面板，支持跨时段数据对比及结果图示生成 -->
<!--
  @component SpatialStatsControl
  @description 空间统计分析控制面板，支持标准差椭圆、心位偏移等空间计量分析的参数设定
  @props 无
  @emits close (关闭面板), stats-query (执行查询), reset (重置)
  @dependencies useGlobalStore, regionApi
-->
<template>
  <div class="spatial-stats-control panel-card" ref="containerRef">
    <div class="panel-header">
      <h1 class="header-title">空间轨迹与标准差椭圆</h1>
      <button class="close-btn" @click.stop="$emit('close')" @keydown.enter.stop title="关闭面板">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="control-body">
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
                  <svg v-if="fromClass === null" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="1.8" fill="none">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
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

          <!-- 箭头/互换按钮 -->
          <div class="swap-btn-container" @click.stop="swapLandTypes" title="点击互换方向">
            <div class="swap-btn" :style="{ transform: `rotate(${rotateDeg}deg)` }">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" stroke-width="1.8">
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
              <svg class="chevron" viewBox="0 0 24 24" width="7" height="7" stroke="currentColor" stroke-width="1.2" fill="none">
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

      <!-- 运算基准尺度 -->
      <div class="control-section">
        <div class="section-label">运行尺度</div>
        <div class="segmented-control">
          <button :class="{ active: unit === 'county' }" @click.stop="unit = 'county'">县级</button>
          <button :class="{ active: unit === 'grid'  }" @click.stop="unit = 'grid'">格网级</button>
        </div>
      </div>

      <!-- 执行按钮 -->
      <div class="footer-actions">
        <!-- 重置地图数据 -->
        <button class="reset-btn-ghost" @click="$emit('reset')" title="重置图层数据">
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
import { TRANSFER_CLASS_OPTIONS } from '../../constants/landuse.js';

const globalStore = useGlobalStore();
const props = defineProps({
  visible: { type: Boolean, default: false }
});
const emit = defineEmits(['close', 'stats-query', 'reset']);

const containerRef = ref(null);
const availableYears = computed(() => globalStore.yearsAll);

const yearStart = ref(1985);
const yearEnd   = ref(2023);
const fromClass = ref(1);   // 支持 null（表示全部）
const toClass   = ref(null);   // 默认“耕地净流出”口径
const unit      = ref('county');

const loading   = ref(false);
const errorMsg  = ref('');
const fromOpen  = ref(false);
const toOpen    = ref(false);
const rotateDeg = ref(0);

// 空间统计专题同样使用 transfer 宽表编码（与 /api/analysis/spatial-stats、/api/analysis/transfer-flow 一致）
const landClasses = TRANSFER_CLASS_OPTIONS;

const reactSnap = (newVal, oldVal, updateFn) => {
  const years = availableYears.value;
  if (!years || years.length === 0) return;
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
watch(yearEnd,   (nv, ov) => reactSnap(nv, ov, v => { yearEnd.value = v; validateYear(); }));

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

const validateYear = () => {
  if (yearStart.value >= yearEnd.value) {
    const startIndex = availableYears.value.indexOf(yearEnd.value);
    yearStart.value = availableYears.value[Math.max(0, startIndex - 1)];
  }
};

const handleQuery = () => {
  errorMsg.value = '';
  if (yearStart.value >= yearEnd.value) {
    errorMsg.value = '起始年份必须小于截止年份';
    return;
  }
  loading.value = true;

  const fromLabel = fromClass.value === null ? '全部地类' : (landClasses.find(c => c.value === fromClass.value)?.label || '');
  const toLabel   = toClass.value === null ? '全部地类' : (landClasses.find(c => c.value === toClass.value)?.label || '');
  const directionLabel = (() => {
    if (fromClass.value !== null && toClass.value === null) return `${fromLabel}净流出`;
    if (fromClass.value === null && toClass.value !== null) return `${toLabel}净流入`;
    if (fromClass.value === null && toClass.value === null) return '总流转';
    return `${fromLabel}转${toLabel}`;
  })();

  emit('stats-query', {
    yearStart: yearStart.value,
    yearEnd:   yearEnd.value,
    fromClass: fromClass.value !== null ? fromClass.value : '',
    toClass:   toClass.value !== null ? toClass.value : '',
    unit:      unit.value,
    showBlankBoundary: true,
    showTrajectory:    true,
    showSDE:           true,
    legendTitle: `${yearStart.value}-${yearEnd.value}年 ${directionLabel} `
  });
};

const handleClickOutside = (event) => {
  if (!props.visible) return;
  const path = event.composedPath();
  const isInside  = containerRef.value && path.includes(containerRef.value);
  const isTrigger = path.some(el => el.classList && el.classList.contains('spatial-stats-entry-btn'));
  if (!isInside && !isTrigger) emit('close');
  if (!path.some(el => el.classList && el.classList.contains('custom-select'))) {
    fromOpen.value = false;
    toOpen.value   = false;
  }
};

onMounted(() => { setTimeout(() => window.addEventListener('click', handleClickOutside), 0); });
onUnmounted(() => { window.removeEventListener('click', handleClickOutside); });

const setLoading = (val) => { loading.value = val; };
const setError   = (msg) => { errorMsg.value = msg; loading.value = false; };
defineExpose({ setLoading, setError });
</script>

<style scoped>
.spatial-stats-control {
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
  font-family: inherit;
  overflow: visible;
}

/* 气泡尖角 */
.spatial-stats-control::after {
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

/* Reuse styles from LandRateControl.vue */
.panel-header { position: relative; display: flex; align-items: center; justify-content: center; height: 43px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.header-title { font-weight: 600; font-size: 15px; letter-spacing: 1.5px; color: #fff; margin: 0; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
.close-btn { 
  position: absolute; 
  right: 12px; 
  top: 50%; 
  transform: translateY(-50%); 
  background: rgba(255, 255, 255, 0.05);
  border: none; 
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer; 
  width: 34px; 
  height: 34px; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  border-radius: 50%; 
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); 
}
.close-btn:hover { 
  background: rgba(245, 108, 108, 0.2);
  color: #fff; 
  transform: translateY(-50%) rotate(90deg) scale(1.1); 
}
.close-btn:active {
  transform: translateY(-50%) rotate(90deg) scale(0.95);
}
.control-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.control-section { display: flex; flex-direction: column; gap: 10px; }
.section-label { position: relative; font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.85); padding-left: 10px; display: flex; align-items: center; }
.section-label::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 2px; height: 12px; background: #3B76E1; border-radius: 1px; }
.segmented-control { display: flex; background: rgba(0, 0, 0, 0.25); padding: 4px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.05); }
.segmented-control button { flex: 1; padding: 6px 0; background: transparent; border: none; color: #94A3B8; font-size: 12px; font-weight: 600; cursor: pointer; border-radius: 7px; transition: all 0.3s; }
.segmented-control button.active { background: #3B76E1; color: white; box-shadow: 0 4px 12px rgba(226, 66, 144, 0.3); }
.year-range-picker { display: flex; align-items: center; background: rgba(0, 0, 0, 0.2); border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 6px 10px; }
.range-field { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.field-tag { font-size: 11px; color: rgba(255, 255, 255, 0.65); font-weight: 500; }
.range-field input { width: 100%; background: transparent; border: none; color: rgba(255, 255, 255, 0.95); font-size: 14px; font-weight: 600; text-align: center; outline: none; }
.range-field input[type="number"]::-webkit-inner-spin-button, .range-field input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.range-divider { padding: 0 12px; }
.divider-line { width: 1px; height: 20px; background: rgba(255, 255, 255, 0.1); }
.transfer-box { display: flex; align-items: center; gap: 10px; }
.select-wrapper { flex: 1; position: relative; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 4px 10px; transition: all 0.3s; }
.select-wrapper:hover { border-color: rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.06); }
.select-wrapper.open { border-color: #3B76E1; background: rgba(255, 255, 255, 0.05); }
.select-hint { display: block; font-size: 12px; color: rgba(255, 255, 255, 0.7); font-weight: 500; margin-bottom: 2px; }
.select-trigger { display: flex; align-items: center; justify-content: space-between; cursor: pointer; min-height: 20px; }
.selected-text { font-size: 13px; font-weight: 600; color: rgba(255, 255, 255, 0.9); }
.chevron {
  width: 15px;
  height: 15px;
  color: rgba(255, 255, 255, 0.4);
  transition: transform 0.3s;
}
.open .chevron { transform: rotate(180deg); color: #3B76E1; }
.select-options { position: absolute; bottom: calc(100% + 8px); left: 0; right: 0; background: rgba(30, 40, 50, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; margin: 0; padding: 6px; list-style: none; z-index: 2100; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-height: 220px; overflow-y: auto; }
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
.dropdown-fade-enter-active, .dropdown-fade-leave-active { transition: all 0.2s; }
.dropdown-fade-enter-from, .dropdown-fade-leave-to { opacity: 0; transform: translateY(10px); }
.swap-btn-container { display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 4px; border-radius: 50%; transition: all 0.3s ease; }
.swap-btn-container:hover { transform: scale(1.15); }
.swap-btn { display: flex; align-items: center; justify-content: center; transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
.footer-actions { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.execute-btn { 
  flex: 1; height: 36px; background: linear-gradient(to bottom, #4a85ee, #3B76E1); 
  border: none; border-radius: 8px; color: white; font-weight: 600; font-size: 13px; 
  letter-spacing: 1px; cursor: pointer; transition: all 0.3s; 
  box-shadow: 0 4px 12px rgba(59, 118, 225, 0.25); display: flex; align-items: center; 
  justify-content: center; position: relative; overflow: hidden;
}
.execute-btn::after {
  content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
  background: linear-gradient(120deg, transparent, rgba(255,255,255,0.1), transparent);
  transition: all 0.5s;
}
.execute-btn:hover::after { left: 100%; }
.execute-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.1); }
.execute-btn:disabled { background: #334155; box-shadow: none; cursor: not-allowed; opacity: 0.6; }
.validation-error { color: #FB7185; font-size: 12px; text-align: center; padding: 8px; background: rgba(225, 29, 72, 0.1); border-radius: 8px; }
.spinner-small { display: inline-block; width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: white; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.err-fade-enter-active, .err-fade-leave-active { transition: all 0.3s ease; }
.err-fade-enter-from, .err-fade-leave-to { opacity: 0; transform: translateY(-5px); }
</style>
