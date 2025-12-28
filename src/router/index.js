import { createRouter, createWebHistory } from 'vue-router';

import Portal from '../views/Portal.vue';
import Login from '../views/Login.vue';
import Workbench from '../views/Workbench.vue';
import Analysis from '../views/Analysis.vue';

const routes = [
	{ path: '/', component: Portal },
	{ path: '/login', component: Login },
	{ path: '/workbench', component: Workbench },
	{ path: '/analysis', component: Analysis },
	// 为了兼容旧路径，可以添加重定向
	{ path: '/front', redirect: '/workbench' }
];

const router = createRouter({
	history: createWebHistory(),
	routes
});

export default router;
