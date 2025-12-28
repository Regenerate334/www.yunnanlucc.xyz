<template>
    <div class="login-container">
        <div class="login-box">
            <div class="login-header">
                <h2>系统登录</h2>
                <p>请输入您的账号和密码以访问平台</p>
            </div>

            <form @submit.prevent="handleLogin" class="login-form">
                <div class="form-group">
                    <label for="username">账号</label>
                    <div class="input-wrapper">
                        <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        <input type="text" id="username" v-model="username" placeholder="请输入账号" required />
                    </div>
                </div>

                <div class="form-group">
                    <label for="password">密码</label>
                    <div class="input-wrapper">
                        <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                        <input type="password" id="password" v-model="password" placeholder="请输入密码" required />
                    </div>
                </div>

                <div class="form-options">
                    <label class="remember-me">
                        <input type="checkbox" v-model="rememberMe" />
                        <span>记住我</span>
                    </label>
                    <a href="#" class="forgot-password">忘记密码？</a>
                </div>

                <button type="submit" class="login-btn" :disabled="isLoading">
                    <span v-if="!isLoading">立即登录</span>
                    <div v-else class="btn-spinner"></div>
                </button>
            </form>

            <div class="login-footer">
                <p>© 2025 云南国土空间规划监测预警平台</p>
            </div>
        </div>

        <!-- 背景装饰 -->
        <div class="bg-decoration">
            <div class="circle circle-1"></div>
            <div class="circle circle-2"></div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const username = ref('admin');
const password = ref('123456');
const rememberMe = ref(false);
const isLoading = ref(false);

const handleLogin = () => {
    isLoading.value = true;

    // 模拟登录延迟
    setTimeout(() => {
        isLoading.value = false;
        // 简单验证逻辑（演示用）
        if (username.value === 'admin' && password.value === '123456') {
            router.push('/workbench');
        } else {
            alert('账号或密码错误，请重试（默认：admin / 123456）');
        }
    }, 800);
};
</script>

<style scoped>
.login-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0f172a;
    overflow: hidden;
    position: relative;
}

.login-box {
    width: 100%;
    max-width: 420px;
    background: rgba(30, 41, 59, 0.7);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    padding: 40px;
    z-index: 10;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.login-header {
    text-align: center;
    margin-bottom: 32px;
}

.login-header h2 {
    color: white;
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 8px;
    letter-spacing: 1px;
}

.login-header p {
    color: #94a3b8;
    font-size: 14px;
}

.login-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.form-group label {
    color: #e2e8f0;
    font-size: 14px;
    font-weight: 500;
    padding-left: 4px;
}

.input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.input-icon {
    position: absolute;
    left: 16px;
    width: 20px;
    height: 20px;
    color: #64748b;
}

.input-wrapper input {
    width: 100%;
    height: 52px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0 16px 0 48px;
    color: white;
    font-size: 16px;
    transition: all 0.3s;
}

.input-wrapper input:focus {
    outline: none;
    border-color: #3b82f6;
    background: rgba(15, 23, 42, 0.8);
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.form-options {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
}

.remember-me {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #94a3b8;
    cursor: pointer;
}

.forgot-password {
    color: #3b82f6;
    text-decoration: none;
    transition: color 0.3s;
}

.forgot-password:hover {
    color: #60a5fa;
}

.login-btn {
    height: 52px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 12px;
}

.login-btn:hover:not(:disabled) {
    background: #1d4ed8;
    transform: translateY(-1px);
    box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.4);
}

.login-btn:active:not(:disabled) {
    transform: translateY(0);
}

.login-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

.btn-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.login-footer {
    text-align: center;
    margin-top: 32px;
    color: #64748b;
    font-size: 12px;
}

/* 背景装饰样式 */
.bg-decoration {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
}

.circle {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
}

.circle-1 {
    top: 10%;
    left: 10%;
    width: 400px;
    height: 400px;
    background: rgba(37, 99, 235, 0.15);
}

.circle-2 {
    bottom: 10%;
    right: 10%;
    width: 500px;
    height: 500px;
    background: rgba(6, 182, 212, 0.1);
}
</style>
