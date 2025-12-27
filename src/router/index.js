import { createRouter, createWebHistory } from 'vue-router';

import LoginPage from '../views/LoginPage.vue';
import FrontPage from '../views/FrontPage.vue';

const routes = [
	{ path: '/', component: LoginPage },
	{ path: '/front', component: FrontPage }
];

const router = createRouter({
	history: createWebHistory(),
	routes
});

export default router;
