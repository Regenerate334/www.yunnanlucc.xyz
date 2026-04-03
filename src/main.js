/**
 * 前端项目入口文件 (Frontend Entry Point)
 * 职责：初始化 Vue 实例，挂载 Pinia 状态管理与 Vue Router 路由。
 * 
 * 修改提示：
 * 1. 若需引入全局插件或 CSS 库，请在此处进行 import。
 * 2. 状态管理 (Pinia) 必须在路由挂载前安装，以支持在路由守卫中使用 store。
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'

const pinia = createPinia()

// Ensure Pinia is installed before Router so stores can be used in navigation guards
createApp(App).use(pinia).use(router).mount('#app')
