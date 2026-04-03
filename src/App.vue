<!--
  根组件 (Root Component)
  作用：作为所有视图组件的宿主，管理全局样式与路由导航过渡。
  
  修改提示：
  1. 全局 CSS 变量和基础重置样式在此组件的 <style> 块中定义。
  2. :key="$route.fullPath" 用于强制在路由参数变化时销毁并重建组件（如同一组件不同 ID 的切换）。
-->
<script setup>
</script>

<template>
  <router-view :key="$route.fullPath" />
</template>

<style>
@import "tailwindcss";

html,
body,
#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  /* 全局禁用文本选中*/
  user-select: none;
  -webkit-user-select: none;
}

/* 恢复输入框、文本域等的选中能力 */
input, textarea, select, [contenteditable="true"] {
  user-select: auto;
  -webkit-user-select: auto;
}
</style>