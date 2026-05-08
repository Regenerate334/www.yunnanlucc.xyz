/**
 * @module utils/crypto
 * @description 前端数据加密与解密工具，确保敏感数据安全。
 * @author System
 * @dependencies crypto-js
 */

/**
 * 前端非对称加密工具 (Frontend RSA Encryption Utility)
 * 职责：从后端获取 RSA 公钥，并使用 RSA-OAEP (SHA-256) 对敏感数据（如密码）进行加密，确保传输安全。
 */
import { API_BASE_URL } from '../config/index.js';

/**
 * 将 PEM 格式的公钥转换为适用于 Web Crypto API 的 ArrayBuffer
 * @param {string} pem - PEM 格式公钥字符串
 */
function pemToArrayBuffer(pem) {
    const b64 = pem
        .replace(/-----BEGIN PUBLIC KEY-----/, '')
        .replace(/-----END PUBLIC KEY-----/, '')
        .replace(/\s/g, '');
    const binary = window.atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

let cachedPublicKey = null;

/**
 * 获取并导入后端提供的 RSA 公钥
 */
export async function fetchPublicKey() {
    if (cachedPublicKey) return cachedPublicKey;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/public-key`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || '获取公钥失败');
        }

        const spkiBuffer = pemToArrayBuffer(result.publicKey);
        cachedPublicKey = await window.crypto.subtle.importKey(
            'spki',
            spkiBuffer,
            {
                name: 'RSA-OAEP',
                hash: 'SHA-256',
            },
            false,
            ['encrypt']
        );
        return cachedPublicKey;
    } catch (err) {
        console.error('[Crypto] 无法初始化加密环境:', err);
        throw new Error('系统安全初始化失败，请检查网络连接');
    }
}

/**
 * 使用 RSA-OAEP 算法加密明文
 * @param {string} plainText - 待加密的明文字符串
 * @returns {string} Base64 格式的密文
 */
export async function encrypt(plainText) {
    if (!plainText) return '';

    try {
        const publicKey = await fetchPublicKey();
        const encoded = new TextEncoder().encode(plainText);
        const encryptedBuffer = await window.crypto.subtle.encrypt(
            {
                name: 'RSA-OAEP',
            },
            publicKey,
            encoded
        );

        // 转换为 Base64 字符串用于传输
        return window.btoa(
            String.fromCharCode.apply(null, new Uint8Array(encryptedBuffer))
        );
    } catch (err) {
        console.error('[Crypto] 加密执行失败:', err);

        // 区分错误原因，防止直接吞噬原始错误
        if (!window.crypto || !window.crypto.subtle) {
            throw new Error('数据安全处理异常：当前非 HTTPS 环境或 localhost，浏览器已禁用底层加密模块 (Web Crypto API)。');
        }

        throw new Error(err.message || '数据安全处理异常');
    }
}

export default {
    fetchPublicKey,
    encrypt
};
