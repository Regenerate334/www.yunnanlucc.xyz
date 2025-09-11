import { createRouter, createWebHistory } from 'vue-router';

import login_page from '../components/login_page.vue';
import front_page from '../components/front_page.vue';

const routes = [
	{ path: '/', component: login_page },
	{ path: '/front', component: front_page }
];

const router = createRouter({
	history: createWebHistory(),
	routes
});

export default router;
