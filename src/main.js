import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router/index.js'
import { pinia } from './store/index.js'

createApp(App).use(router).use(pinia).mount('#app')
