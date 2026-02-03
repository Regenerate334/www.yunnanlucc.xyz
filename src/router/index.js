import { createRouter, createWebHistory } from 'vue-router';

import Portal from '../views/Portal.vue';
import Login from '../views/Login.vue';
import Workbench from '../views/Workbench.vue';
import Analysis from '../views/Analysis.vue';
import RegionalAnalysis from '../views/RegionalAnalysis.vue';

const routes = [
	{ path: '/', component: Portal },
	{ path: '/login', component: Login },
	{ path: '/workbench', component: Workbench },
	{ path: '/analysis', component: Analysis },
	{ path: '/regional-analysis', component: RegionalAnalysis },
	// 为了兼容旧路径，可以添加重定向
	{ path: '/front', redirect: '/workbench' }
];

const router = createRouter({
	history: createWebHistory(),
	routes
});

// 导航守卫
router.beforeEach((to, from, next) => {
	const token = localStorage.getItem('auth_token');
	console.log(`[Router] From: ${from.path} To: ${to.path} Token: ${token ? 'Present' : 'Missing'}`);

	// 如果访问的是登录页或门户页，直接放行
	if (to.path === '/login' || to.path === '/') {
		// 如果已登录用户访问登录页，可以考虑跳转到工作台，但目前保持现状
		next();
	} else {
		// 如果访问的是受保护页面且没有 Token，重定向到登录页
		if (!token) {
			console.warn(`[Router] Access denied to ${to.path}. Redirecting to /login`);
			next('/login');
		} else {
			next();
		}
	}
});

export default router;
