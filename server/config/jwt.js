/**
 * 系统配置模块 (System Configuration Module)
 * 职责：负责加载并向系统暴露有关 jwt 的全局静态配置或环境变量。
 *
 * 修改提示：
 * 1. 敏感密钥或连接串应从 .env 中读取，严禁硬编码。
 * 2. 若涉及异步操作，请务必处理 Promise 的 catch 块防止未捕获异常。
 * 3. 遵循现有的 ESLint 和团队代码规范，保持极简及高可读性。
 */
import logger from './logger.js';

const isProduction = process.env.NODE_ENV === 'production';
const rawSecret = process.env.JWT_SECRET?.trim();

if (!rawSecret) {
  if (isProduction) {
    throw new Error('FATAL: JWT_SECRET environment variable is not defined in production.');
  }
  logger.warn('WARNING: JWT_SECRET is not defined, using insecure fallback for development only.');
}

export const JWT_SECRET = rawSecret || 'dev_insecure_secret_change_me';
export const USING_DEV_JWT_FALLBACK = !rawSecret;
