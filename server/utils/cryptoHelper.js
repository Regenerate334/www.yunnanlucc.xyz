/**
 * 后端加密解密辅助工具 (Backend Crypto Helper)
 * 职责：管理 RSA 密钥对的生成、存储以及对前端传输的密文进行非对称解密。
 * 
 * 修改提示：
 * 1. 密钥文件存储在 server/config/keys/ 目录下，请勿泄露私钥。
 * 2. 解密算法对齐前端 Web Crypto API 的 RSA-OAEP (SHA-256) 规范。
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KEY_DIR = path.resolve(__dirname, '../config/keys');
const PRIVATE_KEY_PATH = path.join(KEY_DIR, 'auth_private.pem');
const PUBLIC_KEY_PATH = path.join(KEY_DIR, 'auth_public.pem');

// 确保密钥目录存在
if (!fs.existsSync(KEY_DIR)) {
    fs.mkdirSync(KEY_DIR, { recursive: true });
}

/**
 * 确保密钥对已生成，若不存在则自动创建
 */
export function ensureKeys() {
    if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
        logger.info('[Crypto] 正在生成新的 RSA 密钥对...');
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
        fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);
        fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
        logger.info('[Crypto] 密钥对生成成功并已保存。');
    }
}

/**
 * 获取 PEM 格式公钥
 */
export function getPublicKey() {
    ensureKeys();
    return fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
}

/**
 * 使用私钥解密密文
 * @param {string} encryptedBase64 - Base64 编码的密文
 * @returns {string} 解密后的明文字符串
 */
export function decrypt(encryptedBase64) {
    ensureKeys();
    try {
        const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
        const buffer = Buffer.from(encryptedBase64, 'base64');
        const decrypted = crypto.privateDecrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            buffer
        );
        return decrypted.toString('utf8');
    } catch (err) {
        logger.error('[Crypto] 解密失败', { message: err?.message || String(err), stack: err?.stack });
        throw new Error('无法通过私钥解密数据，请检查密钥对齐情况');
    }
}

export default {
    ensureKeys,
    getPublicKey,
    decrypt
};
