<!--
  @component DashboardSubNav
  @description 数据大屏二级导航栏，包含区域/年份筛选器及核心业务工具箱入口
  @props year (当前年份)
  @emits update:year
  @dependencies 无
-->
<template>
  <div class="dashboard-subnav">
    <div class="subnav-content">
      
      <!-- 左侧：主题标题 & 播放控制 -->
      <div class="left-section">
        <button class="play-btn">
          <svg viewBox="0 0 24 24" class="play-icon"><path fill="currentColor" d="M8,5.14V19.14L19,12.14L8,5.14Z" /></svg>
        </button>
        <div class="theme-title">国土空间格局 <span class="grid-icon">::</span></div>
      </div>

      <!-- 中间偏左：区域与年份下拉框 -->
      <div class="filter-section">
        <div class="custom-select">
          <span class="select-text">全国</span>
          <span class="dropdown-arrow">▾</span>
        </div>
        <div class="custom-select">
          <span class="select-text">{{ year }}年</span>
          <span class="dropdown-arrow">▾</span>
        </div>
      </div>

      <!-- 右侧占位以保持平衡，居中工具栏 -->
      <div class="spacer"></div>

      <!-- 中间偏右：核心工具图标栏 (半透明蓝色容器) -->
      <div class="tools-section">
        <div class="tools-container">
          <button class="tool-btn icon-expand" title="展开/收起">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            <svg viewBox="0 0 24 24" style="margin-left:-12px"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>
          <div class="tool-divider"></div>
          <button class="tool-btn" title="数据库"><span class="emoji-icon">🗄️</span></button>
          <button class="tool-btn" title="保存"><span class="emoji-icon">💾</span></button>
          <div class="tool-divider"></div>
          <button class="tool-btn active" title="时序分析"><span class="emoji-icon">⏱️</span></button>
          <button class="tool-btn" title="图层管理"><span class="emoji-icon">📑</span></button>
          <button class="tool-btn" title="三维地球"><span class="emoji-icon">🌍</span></button>
          <button class="tool-btn" title="空间定位"><span class="emoji-icon">📍</span></button>
          <button class="tool-btn with-arrow" title="业务工具箱">
            <span class="emoji-icon">💼</span>
            <span class="small-arrow">▾</span>
          </button>
        </div>
      </div>

      <!-- 最右侧：规划实施动态 -->
      <div class="right-section">
        <button class="dynamic-btn">
          <span class="btn-text">规划实施动态</span>
          <svg viewBox="0 0 24 24" class="menu-lines"><path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  year: { type: Number, default: 2024 }
});
const emit = defineEmits(['update:year']);
</script>

<style scoped>
.dashboard-subnav {
  position: absolute;
  top: 64px; /* Default top-nav height */
  left: 0;
  width: 100%;
  height: 48px;
  /* 调亮背景 */
  background: linear-gradient(90deg, 
      rgba(20, 45, 90, 0.5) 0%, 
      rgba(30, 65, 120, 0.4) 20%, 
      rgba(30, 65, 120, 0.4) 80%, 
      rgba(20, 45, 90, 0.5) 100%
  );
  border-bottom: 1.5px solid rgba(0, 245, 255, 0.4);
  backdrop-filter: blur(15px) saturate(150%);
  -webkit-backdrop-filter: blur(15px) saturate(150%);
  
  /* 性能优化：显式分层与隔离 */
  contain: paint;
  transform: translateZ(1px);
  will-change: transform, opacity;
  
  z-index: 1000;
  display: flex;
  align-items: center;
  padding: 0 30px;
  box-sizing: border-box;
}

.subnav-content {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 20px;
}

/* 左侧标题 */
.left-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.play-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(0, 245, 255, 0.4), rgba(0, 102, 255, 0.6));
  border: 1px solid rgba(0, 245, 255, 0.8);
  box-shadow: 0 0 10px rgba(0, 245, 255, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  color: #fff;
  cursor: pointer;
  transition: all 0.3s;
}

.play-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 0 15px rgba(0, 245, 255, 0.8);
}

.play-icon {
  width: 18px;
  height: 18px;
  margin-left: 2px;
}

.theme-title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
  text-shadow: 0 0 8px rgba(0, 245, 255, 0.6);
  display: flex;
  align-items: center;
  gap: 8px;
}

.grid-icon {
  font-size: 20px;
  color: rgba(0, 245, 255, 0.5);
  line-height: 1;
  transform: translateY(-2px);
  font-weight: normal;
}

/* 下拉框区 */
.filter-section {
  display: flex;
  gap: 12px;
}

.custom-select {
  height: 32px;
  padding: 0 12px;
  background: rgba(10, 25, 55, 0.6);
  border: 1px solid rgba(0, 245, 255, 0.3);
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.custom-select:hover {
  background: rgba(0, 245, 255, 0.15);
  border-color: rgba(0, 245, 255, 0.8);
}

.select-text {
  color: #c0d1e8;
  font-size: 14px;
}

.dropdown-arrow {
  color: #00f5ff;
  font-size: 12px;
}

/* 中间占位 */
.spacer {
  flex-grow: 1;
}

/* 工具栏 */
.tools-section {
  display: flex;
  align-items: center;
}

.tools-container {
  display: flex;
  align-items: center;
  background: rgba(14, 46, 110, 0.4);
  border: 1px solid rgba(0, 245, 255, 0.2);
  border-radius: 6px;
  height: 36px;
  padding: 0 6px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

.tool-btn {
  background: transparent;
  border: none;
  width: 32px;
  height: 28px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  position: relative;
}

.tool-btn:hover {
  background: rgba(0, 245, 255, 0.15);
  color: #fff;
}

.tool-btn.active {
  background: linear-gradient(180deg, rgba(0, 102, 255, 0.8) 0%, rgba(0, 245, 255, 0.6) 100%);
  color: #fff;
  border: 1px solid rgba(0, 245, 255, 0.5);
  box-shadow: 0 0 8px rgba(0, 245, 255, 0.4);
}

.emoji-icon {
  font-size: 16px;
  filter: grayscale(0.2) opacity(0.8);
}

.tool-btn.active .emoji-icon, .tool-btn:hover .emoji-icon {
  filter: grayscale(0) opacity(1);
}

.icon-expand {
  display: flex;
  color: #00f5ff;
}

.icon-expand svg {
  width: 18px;
  height: 18px;
}

.tool-divider {
  width: 1px;
  height: 16px;
  background: rgba(0, 245, 255, 0.2);
  margin: 0 4px;
}

.with-arrow {
  width: 44px;
  gap: 2px;
}

.small-arrow {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

/* 最右侧：动态按钮 */
.right-section {
  display: flex;
  align-items: center;
  margin-left: 20px;
}

.dynamic-btn {
  height: 36px;
  padding: 0 16px;
  background: rgba(14, 46, 110, 0.6);
  border: 1px solid rgba(0, 245, 255, 0.2);
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.dynamic-btn:hover {
  background: rgba(0, 245, 255, 0.2);
  border-color: rgba(0, 245, 255, 0.8);
  box-shadow: 0 0 10px rgba(0, 245, 255, 0.3);
}

.dynamic-btn .btn-text {
  font-size: 14px;
  color: #fff;
  font-weight: 500;
  letter-spacing: 1px;
}

.menu-lines {
  width: 20px;
  height: 20px;
  color: #00f5ff;
}
</style>
