import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

import Portal from '../views/Portal.vue';
import Login from '../views/Login.vue';
import Workbench from '../views/Workbench.vue';
import RegionalAnalysis from '../views/RegionalAnalysis.vue';
import Admin from '../views/Admin.vue';

const routes = [
	{ path: '/', redirect: '/portal' },
	{ path: '/portal', component: Portal },
	{ path: '/login', component: Login },
	{ path: '/workbench', component: Workbench },
	{ path: '/regional-analysis', component: RegionalAnalysis },
	{
		path: '/admin',
		component: Admin,
		meta: { requiredRole: 'super_admin' }
	},
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
		// console.log('[Router] Verifying token with backend...');
		const isValid = await authStore.checkAuth();
		if (isValid) {
			// Check roles for specific routes
			if (to.meta.requiredRole && authStore.user?.role !== to.meta.requiredRole) {
				console.warn(`[Router] Access denied. Role ${to.meta.requiredRole} required.`);
				next('/workbench');
				return;
			}
			next();
		} else {
			console.warn(`[Router] Token invalid. Redirecting to /login`);
			next('/login');
		}
	}
});

export default router;
