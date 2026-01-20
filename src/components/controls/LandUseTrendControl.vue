<template>
  <div class="land-use-trend-control">
    <button @click="toggleChart" class="control-btn" :class="{ active: isVisible }" title="土地利用变化趋势">
      <img src="../../assets/icons/zhexiantu_icon.png" alt="趋势图" class="icon-img" />
    </button>

    <Teleport to="body">
      <transition name="fade">
        <div v-if="isVisible" class="modal-backdrop" @click="toggleChart"></div>
      </transition>

      <transition name="slide-fade">
        <div v-if="isVisible" class="modal-window" @click.stop>
          <div class="modal-header">
            <div class="header-placeholder"></div>
            <span class="modal-title">全省土地利用动态监测中心</span>
            <button class="close-btn" @click.stop="toggleChart">✕</button>
          </div>
          <div class="chart-wrapper">
            <!-- AI 悬浮球 (左上角) -->
            <div class="ai-floating-ball-container">
              <button class="ai-floating-ball" @click.stop="openAIAnalysis">
                <div class="ball-content">
                  <svg class="ai-ball-logo" viewBox="0 0 1391 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M1299.71873948 109.08164852c-12.94676356-6.47485468-18.53640721 5.86654827-26.09973268 12.13814317-2.57756953 2.02376031-4.77807747 4.65435413-6.9785854 7.08168819-18.91788751 20.63528526-41.02017805 34.19182812-69.92725219 32.57311445-42.23384508-2.42733405-78.29772513 11.12773591-110.16384908 44.10589701-6.77679853-40.66668282-29.28560862-64.94444203-63.55255448-80.5232723-17.95608583-8.09209545-36.06388005-16.1856638-48.63358202-33.78825438-8.74900746-12.5431898-11.12773591-26.50330641-15.52727889-40.26016326-2.7823022-8.29535522-5.56460442-16.79249731-14.92044537-18.20942412-10.19244639-1.61871367-14.16337637 7.08168818-18.15934561 14.36516325-15.93232553 29.74073376-22.12880269 62.51710799-21.49692993 95.69705596 1.36684831 74.65672404 32.27117059 134.13819156 93.62469003 176.42358804 6.9800583 4.8546681 8.77551959 9.71080912 6.57501167 16.7910244-4.17271686 14.56695011-9.18056624 28.7303265-13.55506996 43.29727663-2.78377509 9.30723537-6.95501906 11.32952278-16.74241882 7.28347506-33.66158524-14.36516325-62.745407-35.60875491-88.46513227-61.30196805-43.62425973-43.09548975-83.0772755-90.64060097-132.26613965-127.86659668a581.67054343 581.67054343 0 0 0-35.07703915-24.481019c-50.20074429-49.77065841 6.57501167-90.63912807 19.72650787-95.49526908 13.73181759-5.05792788 4.77955037-22.4572587-39.65480261-22.25547183s-85.07599655 15.3770434-136.87041529 35.60875492c-7.58541892 3.03416756-15.55379103 5.25971475-23.69596497 7.08168819-47.03990759-9.10544849-95.84876434-11.12773591-146.85960188-5.26118764-96.02551195 10.92594905-172.73103555 57.25739323-229.12678414 136.36373875-67.72674425 95.09022244-83.68558192 203.13015422-64.13582166 315.82149433 20.48504978 118.76262107 79.88992666 217.09027084 171.13736116 293.9710692 94.6350973 79.71317902 203.61031862 118.76262107 327.93607115 111.27735912 75.51542292-4.45256725 159.57953934-14.77020989 254.41642352-96.71040901 23.92426399 12.13961607 49.03715574 16.99575708 90.66564022 20.63675815 32.09295007 3.03416756 62.97223311-1.61871367 86.87145787-6.67664152 37.45429471-8.09209545 34.84874013-43.49906349 21.3187094-49.97244528-109.7838417-52.19946535-85.68283009-30.95587367-107.58333375-48.15194474 55.78891504-67.37324899 139.85303146-137.3770918 172.73103558-364.17669887 2.60408167-18.00616433 0.40357375-29.33568711 0-43.90263723-0.20325977-8.90218873 1.76894914-12.34287584 11.75960868-13.3532831 27.49014733-3.23742733 54.19671351-10.92594905 78.70277175-24.68280587 71.11440706-39.65480265 99.81822142-104.80250446 106.59649285-182.89844271 1.01188015-11.9363563-0.20178686-24.27775924-12.56970195-30.54935415M679.88691083 811.94067418c-106.36966673-85.37941333-157.98733782-113.5014334-179.30604723-112.28776638-19.92829476 1.21366703-16.33737217 24.48101902-11.96286845 39.65480263 4.5777635 14.97199677 10.57098089 25.2896394 18.94145388 38.44113563 5.76786417 8.70040186 9.76383341 21.64863831-5.78995764 31.35944742-34.26841876 21.64863831-93.82647692-7.28347506-96.60730623-8.69892897-69.3454579-41.67856295-127.33635378-96.710409-168.17978423-171.97249367-39.45154288-72.43117687-62.33888747-150.1220685-66.13306982-233.07267484-1.01188015-20.02992464 4.77955037-27.11161282 24.27923215-30.75408683a235.19659216 235.19659216 0 0 1 77.91771776-2.0222874c108.59668681 16.18713669 201.05631542 65.75453531 278.54394725 144.25552022 44.23256614 44.71125762 77.69089163 98.12439001 112.18613649 150.32385536 36.64567431 55.43394691 76.0986901 108.24024576 126.2994344 151.53604948 17.72778682 15.17378365 31.86465106 26.7065662 45.41972101 35.20370828-40.84343042 4.65435413-108.99878765 5.66476139-155.60860934-31.96628093m51.00936468-334.83953884c0-8.90218873 6.9815312-15.98387693 15.75557788-15.98387693q2.98408908 0.05155138 5.36134465 1.01188016a15.85720779 15.85720779 0 0 1 10.16740716 14.97199677 15.78061715 15.78061715 0 0 1-15.73053865 15.98387692 15.60386953 15.60386953 0 0 1-15.55379104-15.98387692m158.39238445 82.95060636c-10.1423679 4.24930749-20.30830215 7.89178146-30.09570189 8.29535522-15.12370514 0.81009328-31.66286419-5.46150162-40.61513143-13.15002333-13.96011661-11.93782919-23.92573689-18.61447073-28.09845373-39.45301577-1.79546129-8.90218873-0.81009328-22.65904557 0.78505404-30.54935414 3.59092258-16.99575708-0.40504665-27.92023321-12.13961607-37.8343021-9.55910075-8.09356835-21.72522894-10.31911553-35.07703915-10.31911553-4.98281013 0-9.55910075-2.22407429-12.94823646-4.04604772a13.27669246 13.27669246 0 0 1-5.76639126-18.61299785c1.39041466-2.8323807 8.16868608-9.71228202 9.76236049-10.92594903 18.13136058-10.52090241 39.04649623-7.08021529 58.36795747 0.81009328 17.93104659 7.48526194 31.46107731 21.24359167 51.01083759 40.66668278 19.92829476 23.46913885 23.51921733 29.94399353 34.84874012 47.54511124 8.97877936 13.75685685 17.14746545 27.92023321 22.71206985 44.1044241 3.41270206 10.11732865-0.98684091 18.41121097-12.74644957 23.46913885"
                      fill="#ffffff" />
                  </svg>
                  <span class="ai-ball-text">AI 趋势分析</span>
                </div>
              </button>
            </div>
            <div v-if="isLoading" class="loading-container">
              <div class="spinner"></div>
              <span>正在从数据库加载趋势数据...</span>
            </div>
            <div v-else-if="hasError && localSeriesData.length === 0" class="error-container">
              <span>数据加载失败，请检查后端服务。</span>
              <button @click="fetchTrendData" class="retry-btn">重试</button>
            </div>
            <LandUseTrendChart v-if="isVisible && localSeriesData.length > 0" :seriesData="localSeriesData" />
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- AI 分析弹窗 -->
    <AIAnalysisModal v-model:visible="showAIModal" :year="2023" region="云南省" analysis-type="trend"
      :auto-question="aiAutoQuestion" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import LandUseTrendChart from '../charts/LandUseTrendChart.vue';
import { clcdApi } from '../../api/index.js';
import AIAnalysisModal from '../ui/AIAnalysisModal.vue';

const props = defineProps({
  seriesData: {
    type: Array,
    default: () => []
  }
});

const isVisible = ref(false);
const localSeriesData = ref([]);
const isLoading = ref(false);
const hasError = ref(false);
const showAIModal = ref(false);
const aiAutoQuestion = ref('');

async function fetchTrendData() {
  if (localSeriesData.value.length > 0) return; // 避免重复加载

  isLoading.value = true;
  hasError.value = false;
  try {
    const data = await clcdApi.getProvinceTrend();
    localSeriesData.value = data;
  } catch (error) {
    console.error('Error fetching trend data:', error);
    hasError.value = true;
    if (props.seriesData && props.seriesData.length > 0) {
      localSeriesData.value = props.seriesData;
    }
  } finally {
    isLoading.value = false;
  }
}

function toggleChart() {
  isVisible.value = !isVisible.value;
  if (isVisible.value) {
    fetchTrendData();
  }
}

// 打开 AI 分析弹窗
const openAIAnalysis = () => {
  aiAutoQuestion.value = '分析云南省1985-2023年土地利用变化的总体趋势，重点关注耕地、林地 and 建设用地的变化';
  showAIModal.value = true;
};
</script>

<style scoped>
.land-use-trend-control {
  position: relative;
}

.control-btn {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(13, 25, 48, 0.4);
  backdrop-filter: blur(12px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: #a5ccff;
}

.control-btn:hover {
  background: rgba(30, 58, 138, 0.6);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-2px);
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.control-btn.active {
  background: #3b82f6;
  border-color: #60a5fa;
  color: #ffffff;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
}

.icon-img {
  width: 40px;
  height: 40px;
  object-fit: cover;
  opacity: 0.8;
  transition: opacity 0.3s ease;
}

.control-btn:hover .icon-img {
  opacity: 1;
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 999;
}

.modal-window {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90vw;
  height: 85vh;
  background: rgba(13, 25, 48, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 16px 24px;
  background: rgba(30, 58, 138, 0.3);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-placeholder {
  width: 32px;
}

.modal-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 2px;
  text-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
  white-space: nowrap;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: white;
  font-size: 16px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  transform: rotate(90deg);
}

.chart-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  padding: 24px;
  overflow: hidden;
  position: relative;
  background: rgba(0, 0, 0, 0.1);
}

.loading-container,
.error-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  color: #a5ccff;
  font-size: 15px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(59, 130, 246, 0.1);
  border-left-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.retry-btn {
  padding: 8px 24px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #a5ccff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;
}

.retry-btn:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
  color: #ffffff;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.8);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.8);
}

/* AI 悬浮球样式 */
.ai-floating-ball-container {
  position: absolute;
  top: 20px;
  right: 30px;
  z-index: 100;
}

.ai-floating-ball {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 56px;
  /* 初始圆形宽度 */
  height: 56px;
  padding: 0 14px;
  background: rgba(30, 58, 138, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(59, 130, 246, 0.5);
  border-radius: 28px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  white-space: nowrap;
}

.ai-floating-ball:hover {
  width: 160px;
  /* 展开后的宽度 */
  background: rgba(30, 58, 138, 0.8);
  border-color: rgba(59, 130, 246, 0.8);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
}

.ball-content {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 140px;
  /* 确保文字不换行 */
}

.ai-ball-logo {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.ai-floating-ball:hover .ai-ball-logo {
  transform: scale(1.1) rotate(5deg);
}

.ai-ball-text {
  font-size: 14px;
  font-weight: 600;
  opacity: 0;
  transform: translateX(-10px);
  transition: all 0.4s ease 0.1s;
}

.ai-floating-ball:hover .ai-ball-text {
  opacity: 1;
  transform: translateX(0);
}
</style>
