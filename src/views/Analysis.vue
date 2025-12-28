<template>
  <div class="monitoring-dashboard">
    <!-- 页面头部 -->
    <div class="dashboard-header">
      <h1>国土空间土地利用监测系统</h1>
      <p class="subtitle">Territorial Spatial Planning Monitoring System</p>
      
      <div class="header-actions">
        <button @click="refreshAll" class="action-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M23 4v6h-6M1 20v-6h6" stroke-width="2"/>
            <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke-width="2"/>
          </svg>
          刷新数据
        </button>
        
        <button @click="exportReport" class="action-btn primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke-width="2"/>
          </svg>
          导出报告
        </button>
      </div>
    </div>

    <!-- KPI监测看板 -->
    <section class="dashboard-section">
      <h2 class="section-title">核心指标监测</h2>
      <KPIDashboard />
    </section>

    <!-- 图表网格 -->
    <section class="dashboard-section">
      <h2 class="section-title">可视化分析</h2>
      
      <div class="charts-grid">
        <!-- 土地利用结构 - 饼图 -->
        <div class="chart-card">
          <div class="card-header">
            <h3>土地利用结构</h3>
            <span class="chart-type">饼图</span>
          </div>
          <LandUsePieChart :year="2023" />
        </div>

        <!-- 土地利用趋势 -->
        <div class="chart-card">
          <div class="card-header">
            <h3>土地利用变化趋势</h3>
            <span class="chart-type">折线图</span>
          </div>
          <LandUseTrendChart />
        </div>

        <!-- 堆叠面积图 -->
        <div class="chart-card wide">
          <div class="card-header">
            <h3>土地类型面积变化</h3>
            <span class="chart-type">堆叠面积图</span>
          </div>
          <StackedAreaChart :startYear="1985" :endYear="2023" />
        </div>

        <!-- 土地转移桑基图 -->
        <div class="chart-card wide">
          <div class="card-header">
            <h3>土地类型转移关系</h3>
            <span class="chart-type">桑基图</span>
          </div>
          <LandTransferSankey :startYear="2000" :endYear="2020" />
        </div>

        <!-- 指标雷达图 -->
        <div class="chart-card">
          <div class="card-header">
            <h3>多维指标对比</h3>
            <span class="chart-type">雷达图</span>
          </div>
          <IndicatorRadar :year1="2000" :year2="2023" />
        </div>

        <!-- 预留位置：变化热力图 -->
        <div class="chart-card placeholder">
          <div class="placeholder-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/>
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke-width="2"/>
            </svg>
            <h4>变化热力图</h4>
            <p>开发中...</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 数据统计 -->
    <section class="dashboard-section">
      <h2 class="section-title">数据统计概览</h2>
      
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-label">数据覆盖年份</div>
          <div class="stat-value">1985 - 2023</div>
          <div class="stat-detail">共39年时间序列</div>
        </div>
        
        <div class="stat-item">
          <div class="stat-label">数据层级</div>
          <div class="stat-value">3级</div>
          <div class="stat-detail">省/市/县行政区划</div>
        </div>
        
        <div class="stat-item">
          <div class="stat-label">土地类型</div>
          <div class="stat-value">9类</div>
          <div class="stat-detail">CLCD标准分类</div>
        </div>
        
        <div class="stat-item">
          <div class="stat-label">计算指标</div>
          <div class="stat-value">20+</div>
          <div class="stat-detail">结构/变化/生态/集约</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import LandUsePieChart from '@/components/charts/LandUsePieChart.vue'
import LandUseTrendChart from '@/components/charts/LandUseTrendChart.vue'
import StackedAreaChart from '@/components/charts/StackedAreaChart.vue'
import LandTransferSankey from '@/components/charts/LandTransferSankey.vue'
import IndicatorRadar from '@/components/charts/IndicatorRadar.vue'
import KPIDashboard from '@/components/charts/KPIDashboard.vue'

// Methods
const refreshAll = () => {
  // 刷新所有组件（通过重新加载页面或emit事件）
  window.location.reload()
}

const exportReport = () => {
  // TODO: 实现报告导出功能
  alert('报告导出功能开发中...')
}
</script>

<style scoped>
.monitoring-dashboard {
  width: 100%;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 24px;
}

.dashboard-header {
  text-align: center;
  padding: 40px 20px;
  color: white;
  margin-bottom: 32px;
}

.dashboard-header h1 {
  font-size: 36px;
  font-weight: bold;
  margin-bottom: 8px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.subtitle {
  font-size: 16px;
  opacity: 0.9;
  margin-bottom: 24px;
}

.header-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 24px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  backdrop-filter: blur(10px);
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.action-btn.primary {
  background: rgba(255, 255, 255, 0.95);
  color: #667eea;
}

.action-btn.primary:hover {
  background: white;
}

.action-btn svg {
  width: 20px;
  height: 20px;
}

.dashboard-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 24px;
  font-weight: bold;
  color: white;
  margin-bottom: 20px;
  padding-left: 12px;
  border-left: 4px solid rgba(255, 255, 255, 0.8);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 24px;
}

.chart-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s;
  min-height: 400px;
  display: flex;
  flex-direction: column;
}

.chart-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.chart-card.wide {
  grid-column: span 2;
  min-height: 500px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #f0f0f0;
}

.card-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.chart-type {
  font-size: 12px;
  padding: 4px 12px;
  background: #f5f7fa;
  border-radius: 12px;
  color: #666;
  font-weight: 500;
}

.chart-card.placeholder {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border: 2px dashed rgba(102, 126, 234, 0.3);
}

.placeholder-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}

.placeholder-content svg {
  width: 80px;
  height: 80px;
  margin-bottom: 16px;
  opacity: 0.3;
}

.placeholder-content h4 {
  font-size: 20px;
  margin-bottom: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.stat-item {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s;
}

.stat-item:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-4px);
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-detail {
  font-size: 12px;
  opacity: 0.8;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
  
  .chart-card.wide {
    grid-column: span 1;
  }
}

@media (max-width: 768px) {
  .dashboard-header h1 {
    font-size: 28px;
  }
  
  .header-actions {
    flex-direction: column;
  }
  
  .action-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
