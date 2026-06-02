/**
 * DeepSeek API 状态探测器 (DeepSeek API Status Probe)
 * 职责：定期探测 DeepSeek 官方 API 的可用性，确保 AI 服务在线。
 *
 * 检测方式：向 DeepSeek API 发送轻量级的 models 列表请求。
 * 如果返回 200，则认为 API 可用；否则输出警告并以非零退出码退出（PM2 会自动重试）。
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 从项目根目录加载 .env（status-deepseek.js 位于 ops/sys/ 下，往上两级）
const envPath = path.resolve(__dirname, '../../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('[AI Check Warning] Failed to load .env file from:', envPath);
}

const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

async function check() {
    if (!DEEPSEEK_API_KEY) {
        console.error('[AI Check Error] DEEPSEEK_API_KEY is not configured in .env');
        process.exit(1);
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${DEEPSEEK_BASE_URL}/models`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Accept': 'application/json'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            console.log(`[AI Check] ✓ DeepSeek API is reachable (${DEEPSEEK_BASE_URL})`);
        } else {
            const text = await response.text().catch(() => '');
            console.error(`[AI Check Failed] DeepSeek API returned status ${response.status}: ${text.slice(0, 200)}`);
            process.exit(1);
        }
    } catch (err) {
        if (err?.name === 'AbortError') {
            console.error(`[AI Check Timeout] DeepSeek API connection timed out (${DEEPSEEK_BASE_URL})`);
        } else {
            console.error(`[AI Check Error] DeepSeek API (${DEEPSEEK_BASE_URL}):`, err.message);
        }
        process.exit(1);
    }
}

check();
setInterval(check, 60000);
