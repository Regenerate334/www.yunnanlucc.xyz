import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'

const pinia = createPinia()

// Ensure Pinia is installed before Router so stores can be used in navigation guards
createApp(App).use(pinia).use(router).mount('#app')
