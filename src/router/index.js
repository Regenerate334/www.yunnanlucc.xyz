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

// 导航守卫
router.beforeEach((to, from, next) => {
	const token = localStorage.getItem('auth_token');

	// 如果访问的是登录页或门户页，直接放行
	if (to.path === '/login' || to.path === '/') {
		next();
	} else {
		// 如果访问的是受保护页面且没有 Token，重定向到登录页
		if (!token) {
			next('/login');
		} else {
			next();
		}
	}
});

export default router;
