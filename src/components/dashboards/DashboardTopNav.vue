<!--
  @component DashboardTopNav
  @description 数据大屏顶部主导航，采用流线型设计，支持 6 大核心专题的主题切换
  @props activeTheme (当前活跃主题)
  @emits update:activeTheme
  @dependencies 无
-->
<template>
  <div class="top-nav-container">
    
    <!-- 左侧标题区 (长摆尾流线型标题梁) -->
    <div class="nav-left">
      <div class="title-beam">
        <div class="logo-text">
          <span class="main-txt">国土空间规划 “一张图” 实施监督信息系统（CSPON）</span>
        </div>
        <!-- 装饰性光条摆尾 -->
        <div class="beam-tail">
          <div class="tail-line"></div>
          <div class="glow-dot dot-1"></div>
          <div class="glow-dot dot-2"></div>
        </div>
      </div>
    </div>

    <!-- 右侧功能区域 (菜单 + 用户) -->
    <div class="nav-right">
      <div class="menu-list">
        <div 
          v-for="item in menuItems" 
          :key="item.value"
          class="menu-btn"
          :class="{ active: activeTheme === item.value, special: item.value === 'scenarios' }"
          @click="$emit('update:activeTheme', item.value)"
        >
          <!-- 激活状态的底部指示器 (金黄色发光线条) -->
          <div v-if="activeTheme === item.value" class="active-indicator-bottom"></div>
          <div class="btn-inner">
            <span class="btn-text">{{ item.label }}</span>
            <span v-if="item.hasDropdown" class="dropdown-arrow">▾</span>
            <div class="btn-glow-bar"></div>
          </div>
        </div>
      </div>

      <!-- 用户信息胶囊区 -->
      <div class="user-capsule">
        <div class="user-avatar">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6.02-3.22.03-1.99 4.02-3.08 6.02-3.08 1.99 0 5.99 1.09 6.02 3.08-1.31 1.94-3.52 3.22-6.02 3.22z"/>
          </svg>
        </div>
        <span class="user-name">管理员 <span class="dropdown-arrow">▾</span></span>
        <div class="user-glow-line"></div>
      </div>
    </div>

    <!-- 全局底边框装饰线 -->
    <div class="header-bottom-line"></div>
  </div>
</template>

<script setup>
const props = defineProps({
  activeTheme: { type: String, default: 'optimization' }
});

const emit = defineEmits(['update:activeTheme']);

const menuItems = [
  { label: '安全底线管控', value: 'baseline', hasDropdown: true },
  { label: '空间规划传导', value: 'transmission' },
  { label: '空间格局优化', value: 'optimization' },
  { label: '绿色低碳发展', value: 'green' },
  { label: '重大战略区域', value: 'strategic' },
  { label: 'N+应用场景', value: 'scenarios', hasDropdown: true }
];
</script>

<style scoped>
.top-nav-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 64px;
  /* 调亮背景 */
  background: linear-gradient(180deg, rgba(15, 30, 70, 0.6) 0%, rgba(10, 20, 50, 0.7) 100%);
  backdrop-filter: blur(25px) saturate(150%);
  
  /* 解决 backdrop-filter 延迟渲染的 GPU 强启发方案 */
  contain: paint;
  transform: translateZ(1px);
  will-change: transform, opacity;

  padding: 0 30px;
  box-sizing: border-box;
  z-index: 2000;
  position: relative;
  overflow: hidden;
}

/* 左侧标题梁 */
.nav-left {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.title-beam {
  position: relative;
  height: 40px;
  padding: 0 60px 0 24px;
  display: flex;
  align-items: center;
  /* 调亮标题梁 */
  background: linear-gradient(90deg, rgba(22, 63, 140, 0.8) 0%, rgba(13, 40, 90, 0.6) 80%, transparent 100%);
  clip-path: polygon(0 0, 90% 0, 100% 100%, 0 100%);
  border-left: 4px solid #00f5ff;
}

.logo-text {
  display: flex;
  align-items: baseline;
  gap: 12px;
  color: #fff;
  white-space: nowrap;
  z-index: 10;
}

.main-txt {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 1.8px;
  text-shadow: 0 0 15px rgba(0, 245, 255, 0.4);
}

.abbr-txt {
  font-size: 15px;
  font-weight: 600;
  color: #a2fbff;
  opacity: 0.8;
}

/* 标题梁摆尾效果 */
.beam-tail {
  position: absolute;
  right: -100px;
  top: 50%;
  width: 200px;
  height: 1px;
}

.tail-line {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, #00f5ff, transparent);
  opacity: 0.6;
}

.glow-dot {
  position: absolute;
  width: 4px;
  height: 4px;
  background: #00f5ff;
  border-radius: 50%;
  box-shadow: 0 0 8px #00f5ff;
  animation: flicker 3s infinite;
}

.dot-1 { left: 20px; top: -1px; }
.dot-2 { left: 80px; top: -1px; }

/* 右侧组件区 */
.nav-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.menu-list {
  display: flex;
  gap: 14px;
}

/* 菜单按钮：斜切梯形 */
.menu-btn {
  position: relative;
  height: 40px;
  padding: 0 24px;
  cursor: pointer;
  background: transparent;
  /* 使用 clip-path 制作斜切平行四边形特效 \ \ */
  clip-path: polygon(15px 0, 100% 0, calc(100% - 15px) 100%, 0 100%);
  transition: all 0.3s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  border-bottom: 2px solid transparent; /* reserved space */
}

.btn-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 2;
}

.btn-text {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.3s;
  letter-spacing: 0.5px;
}

.dropdown-arrow {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-family: monospace;
  margin-top: 2px;
}

.menu-btn:hover {
  background: rgba(0, 245, 255, 0.1);
}

.menu-btn.active {
  background: linear-gradient(180deg, rgba(245, 166, 35, 0.05) 0%, rgba(245, 166, 35, 0.25) 100%);
}

.menu-btn.active .btn-text,
.menu-btn.active .dropdown-arrow {
  color: #fce28b;
  text-shadow: 0 0 8px rgba(245, 166, 35, 0.6);
  font-weight: 700;
}

/* N+应用场景的特殊样式 (带网格感) */
.menu-btn.special {
  background: linear-gradient(180deg, rgba(0, 245, 255, 0.1) 0%, rgba(0, 245, 255, 0.25) 100%),
              repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px);
}

.menu-btn.special:hover {
  background: linear-gradient(180deg, rgba(0, 245, 255, 0.2) 0%, rgba(0, 245, 255, 0.4) 100%),
              repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px);
}

/* 底部金黄色激活指示器 */
.active-indicator-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: #fce28b;
  box-shadow: 0 -2px 10px #f5a623;
  z-index: 5;
}

/* 用户胶囊区 */
.user-capsule {
  position: relative;
  height: 38px;
  padding: 0 15px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(90deg, transparent, rgba(14, 46, 110, 0.6) 20%, rgba(14, 46, 110, 0.8) 100%);
  clip-path: polygon(15% 0, 100% 0, 100% 100%, 0 100%);
  border-right: 2px solid #00f5ff;
}

.user-avatar {
  width: 26px;
  height: 26px;
  background: rgba(0, 245, 255, 0.1);
  border-radius: 50%;
  color: #00f5ff;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid rgba(0, 245, 255, 0.3);
}

.user-name {
  font-size: 13px;
  color: #fff;
  font-weight: 500;
}

.dropdown-icon {
  width: 14px;
  height: 14px;
  opacity: 0.6;
  color: #00f5ff;
}

.user-glow-line {
  position: absolute;
  bottom: 0px;
  right: 0;
  width: 80%;
  height: 2px;
  background: #00f5ff;
  box-shadow: 0 0 8px #00f5ff;
}

/* 底边装饰线 */
.header-bottom-line {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 245, 255, 0.5), transparent);
}

@keyframes flicker {
  0% { opacity: 0.2; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.1); }
  100% { opacity: 0.2; transform: scale(0.8); }
}

</style>
