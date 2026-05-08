/**
 * @module stores/auth
 * @description Pinia 状态管理：用户鉴权模块，处理登录态、令牌存储与路由权限校验。
 * @author System
 * @dependencies pinia, crypto.js
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { authApi } from '../api/index.js';
import { encrypt } from '../utils/crypto.js';

export const useAuthStore = defineStore('auth', () => {
    // State
    const token = ref(localStorage.getItem('auth_token') || '');
    const user = ref(JSON.parse(localStorage.getItem('user_info') || 'null'));
    // Important: Default to false to force backend verification on first load
    const isAuthenticated = ref(false);

    // Actions
    async function login(username: string, password: string) {
        try {
            // [Security] 强制对传输过程中的密码进行 RSA 公钥加密，对齐后端解密规范
            const encryptedPassword = await encrypt(password);
            const res = await authApi.login(username, encryptedPassword);
            if (res.success) {
                setSession(res.token, res.user);
                return true;
            }
            return false;
        } catch (error) {
            throw error;
        }
    }


    function logout() {
        token.value = '';
        user.value = null;
        isAuthenticated.value = false;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
    }

    async function checkAuth() {
        if (!token.value) {
            logout();
            return false;
        }
        try {
            // Call backend to verify token
            const res = await authApi.verify();
            if (res && (res.success || res.user)) {
                // Update user info if returned
                if (res.user) {
                    user.value = res.user;
                    localStorage.setItem('user_info', JSON.stringify(res.user));
                }
                isAuthenticated.value = true;
                return true;
            } else {
                logout();
                return false;
            }
        } catch (error) {
            logout();
            return false;
        }
    }

    function setSession(newToken: string, newUser: any) {
        token.value = newToken;
        user.value = newUser;
        isAuthenticated.value = true;
        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('user_info', JSON.stringify(newUser));
    }

    return {
        token,
        user,
        isAuthenticated,
        login,
        logout,
        checkAuth
    };
});
