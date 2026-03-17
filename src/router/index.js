import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

import Portal from '../views/Portal.vue';
import Login from '../views/Login.vue';
import Workbench from '../views/Workbench.vue';
import Analysis from '../views/Analysis.vue';
import RegionalAnalysis from '../views/RegionalAnalysis.vue';

const routes = [
	{ path: '/', redirect: '/portal' },
	{ path: '/portal', component: Portal },
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
router.beforeEach(async (to, from, next) => {
	const authStore = useAuthStore();
	const token = localStorage.getItem('auth_token');

	// public pages
	if (to.path === '/login' || to.path === '/portal') {
		next();
		return;
	}

	// Checking if we have a token
	if (!token) {
		console.warn(`[Router] No token found. Redirecting to /login`);
		next('/login');
		return;
	}

	// logic for token verification
	// valid token?
	if (authStore.isAuthenticated) {
		next();
	} else {
		// has token but not authorized in store (e.g. page refresh)
		// verify with backend
		console.log('[Router] Verifying token with backend...');
		const isValid = await authStore.checkAuth();
		if (isValid) {
			next();
		} else {
			console.warn(`[Router] Token invalid. Redirecting to /login`);
			next('/login');
		}
	}
});

export default router;
