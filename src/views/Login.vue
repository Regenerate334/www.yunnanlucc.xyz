<template>
    <div class="login-container">
        <div class="login-card">
            <div class="login-header">
                <h1 class="login-title">云南国土空间规划监测预警平台</h1>
                <p class="login-subtitle">{{ isLoginMode ? 'WELCOME!' : 'CREATE ACCOUNT' }}</p>
            </div>

            <form @submit.prevent="handleSubmit" class="login-form">
                <div class="input-group">
                    <div class="input-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </div>
                    <input type="text" v-model="username" placeholder="请输入账号" required />
                </div>

                <div class="input-group">
                    <div class="input-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                    </div>
                    <input type="password" v-model="password" placeholder="请输入密码" required />
                </div>



                <div v-if="errorMessage" class="error-message">
                    {{ errorMessage }}
                </div>

                <button type="submit" class="login-btn" :disabled="isLoading">
                    <span v-if="!isLoading">{{ isLoginMode ? '立即登录' : '立即注册' }}</span>
                    <div v-else class="spinner"></div>
                </button>

                <div class="mode-toggle">
                    <a href="#" @click.prevent="isLoginMode = !isLoginMode">
                        {{ isLoginMode ? '没有账号？去注册' : '已有账号？去登录' }}
                    </a>
                </div>
            </form>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const isLoginMode = ref(true);
const username = ref('');
const password = ref('');

const isLoading = ref(false);
const errorMessage = ref('');

const handleSubmit = async () => {
    errorMessage.value = '';
    if (isLoginMode.value) {
        await handleLogin();
    } else {
        await handleRegister();
    }
};

const handleLogin = async () => {
    isLoading.value = true;
    try {
        const success = await authStore.login(username.value, password.value);
        if (success) {
            console.log('[Login] Login successful, navigating to workbench...');
            router.push('/workbench');
        } else {
            errorMessage.value = '登录失败，请检查账号密码';
        }
    } catch (err) {
        errorMessage.value = err.message || '登录失败，请检查账号密码';
    } finally {
        isLoading.value = false;
    }
};

const handleRegister = async () => {
    isLoading.value = true;
    try {
        const res = await authStore.register(username.value, password.value);
        if (res.success) {
            alert('注册成功，请直接登录');
            isLoginMode.value = true;
            password.value = '';
        }
    } catch (err) {
        errorMessage.value = err.message || '注册失败';
    } finally {
        isLoading.value = false;
    }
};
</script>

<style scoped>
.login-container {
    width: 100vw;
    height: 100vh;
    background-image: url('../assets/images/login_bg.png');
    background-size: cover;
    background-position: center;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "Microsoft YaHei", -apple-system, sans-serif;
}

.login-card {
    width: 450px;
    background: #ffffff;
    border-radius: 20px;
    padding: 50px 45px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
    text-align: center;
}

.login-header {
    margin-bottom: 40px;
}

.login-title {
    font-size: 32px;
    color: #333333;
    font-weight: 600;
    margin-bottom: 12px;
    letter-spacing: 1px;
}

.login-subtitle {
    font-size: 14px;
    color: #999999;
    letter-spacing: 2px;
    text-transform: uppercase;
}



.login-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.input-group {
    position: relative;
    display: flex;
    align-items: center;
}

.input-icon {
    position: absolute;
    left: 15px;
    width: 20px;
    height: 20px;
    color: #409eff;
    display: flex;
    align-items: center;
    justify-content: center;
}

.input-group input {
    width: 100%;
    height: 50px;
    background: #f5f7fa;
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    padding: 0 15px 0 45px;
    font-size: 15px;
    color: #606266;
    transition: all 0.3s;
}

.input-group input:focus {
    outline: none;
    border-color: #409eff;
    background: #ffffff;
    box-shadow: 0 0 8px rgba(64, 158, 255, 0.1);
}



.login-btn {
    margin-top: 20px;
    height: 50px;
    background: #1890ff;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.login-btn:hover {
    background: #40a9ff;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
}

.login-btn:active {
    transform: translateY(0);
}

.login-btn:disabled {
    background: #a0cfff;
    cursor: not-allowed;
}

.spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.mode-toggle {
    margin-top: 15px;
    font-size: 14px;
}

.mode-toggle a {
    color: #409eff;
    text-decoration: none;
    transition: color 0.3s;
}

.mode-toggle a:hover {
    color: #66b1ff;
}

.error-message {
    color: #f56c6c;
    font-size: 14px;
    margin-top: 10px;
    text-align: center;
}
</style>
