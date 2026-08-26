/**
 * 权威网页资料读取工具
 *
 * 先读取政策/文献库中登记的来源 URL，再对通过白名单校验的公开页面执行静态抓取。
 * 工具不执行网页脚本、不提交表单，也不允许访问本机或私有网络地址。
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import registry from '../../dataSourceRegistry.js';
import logger from '../../../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '../../../..');
const POLICY_CORPUS_PATH = path.join(PROJECT_ROOT, 'server', 'knowledge', 'corpus', 'policy_corpus.json');

const DEFAULT_TIMEOUT_MS = 15000;
// 只限制网络响应体的异常体积，正文提取后不再按字符数裁剪。
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

const DEFAULT_ALLOWED_HOSTS = [
    'gov.cn',
    'mnr.gov.cn',
    'naturalresources.gov.cn',
    'dnr.yn.gov.cn',
    'yn.gov.cn',
    'km.gov.cn',
    'ghzrzyj.km.gov.cn',
    'arxiv.org',
    'pmc.ncbi.nlm.nih.gov',
    'ncbi.nlm.nih.gov',
    'plos.org',
    'frontiersin.org',
    'mdpi.com',
    'springeropen.com',
    'copernicus.org'
];

const pageCache = new Map();

function normalizeText(value) {
    return String(value ?? '').trim();
}

function parsePositiveInteger(value, fallback, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function configuredAllowedHosts() {
    const configured = normalizeText(process.env.WEB_FETCH_ALLOWED_HOSTS)
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    return [...new Set([...DEFAULT_ALLOWED_HOSTS, ...configured])];
}

function isPrivateHost(hostname) {
    const host = hostname.toLowerCase();
    if (host === 'localhost' || host === 'ip6-localhost' || host === '0.0.0.0' || host === '::1') return true;
    if (/^(10|127)\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
    if (/^169\.254\./.test(host)) return true;
    return false;
}

function hostMatchesRule(hostname, rule) {
    const host = hostname.toLowerCase();
    const normalizedRule = normalizeText(rule).toLowerCase().replace(/^\.+/, '');
    return Boolean(normalizedRule) && (host === normalizedRule || host.endsWith(`.${normalizedRule}`));
}

function canonicalUrl(rawUrl) {
    const parsed = new URL(normalizeText(rawUrl));
    parsed.hash = '';
    return parsed.toString();
}

function validateUrl(rawUrl, registeredUrls = new Set()) {
    const url = new URL(normalizeText(rawUrl));
    if (url.protocol !== 'https:') {
        throw new Error('仅允许通过 HTTPS 读取公开来源。');
    }
    if (isPrivateHost(url.hostname)) {
        throw new Error('禁止访问本机或私有网络地址。');
    }

    const normalized = canonicalUrl(url.href);
    const isRegistered = registeredUrls.has(normalized);
    const isAllowedHost = configuredAllowedHosts().some((rule) => hostMatchesRule(url.hostname, rule));
    if (!isRegistered && !isAllowedHost) {
        throw new Error('来源不在已登记链接或权威公开站点白名单内。');
    }
    return normalized;
}

async function loadRegisteredUrls() {
    try {
        const raw = await fs.readFile(POLICY_CORPUS_PATH, 'utf8');
        const corpus = JSON.parse(raw);
        const entries = Array.isArray(corpus) ? corpus : [];
        return new Set(entries
            .flatMap((entry) => Array.isArray(entry?.sources) ? entry.sources : [])
            .map((source) => {
                try { return canonicalUrl(source); } catch { return ''; }
            })
            .filter(Boolean));
    } catch (error) {
        logger.warn(`[webFetchTool] 无法读取已登记来源: ${error.message}`);
        return new Set();
    }
}

function timeoutSignal(timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return { controller, timer };
}

async function fetchPage(url, timeoutMs, registeredUrls) {
    const { controller, timer } = timeoutSignal(timeoutMs);
    let currentUrl = url;

    try {
        for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
            const response = await fetch(currentUrl, {
                method: 'GET',
                redirect: 'manual',
                signal: controller.signal,
                headers: {
                    Accept: 'text/html,application/xhtml+xml,text/plain,application/json,application/pdf;q=0.8,*/*;q=0.2',
                    'User-Agent': 'WebGIS-GeoAI-Agent/1.0 (public-source-reader)'
                }
            });

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                if (!location || redirectCount === MAX_REDIRECTS) {
                    throw new Error('网页重定向次数超过限制。');
                }
                await response.body?.cancel();
                currentUrl = validateUrl(new URL(location, currentUrl).href, registeredUrls);
                continue;
            }

            if (!response.ok) {
                throw new Error(`网页返回 HTTP ${response.status}。`);
            }

            const contentType = contentTypeOf(response);
            if (contentType === 'application/pdf') {
                await response.body?.cancel();
                return { response, finalUrl: currentUrl, rawBody: '' };
            }

            const supportedContentTypes = [
                'text/html',
                'application/xhtml+xml',
                'text/plain',
                'application/json',
                'application/ld+json'
            ];
            if (contentType && !supportedContentTypes.includes(contentType)) {
                await response.body?.cancel();
                throw new Error(`不支持读取 ${contentType} 类型的网页内容。`);
            }

            // 正文读取必须共用同一个 AbortSignal，确保超时覆盖完整下载过程。
            const rawBody = await readLimitedBody(response);
            return { response, finalUrl: currentUrl, rawBody };
        }
    } catch (error) {
        if (error?.name === 'AbortError') throw new Error('网页读取超时。');
        throw error;
    } finally {
        clearTimeout(timer);
    }

    throw new Error('网页读取失败。');
}

async function readLimitedBody(response) {
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
        throw new Error('网页正文超过读取大小限制。');
    }

    if (!response.body) return '';
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            totalBytes += value.byteLength;
            if (totalBytes > MAX_BODY_BYTES) {
                await reader.cancel();
                throw new Error('网页正文超过读取大小限制。');
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder('utf-8').decode(bytes);
}

function decodeHtmlEntities(value) {
    return value
        .replace(/&#(\d+);?/g, (_, code) => {
            const number = Number(code);
            return Number.isFinite(number) ? String.fromCodePoint(Math.min(number, 0x10ffff)) : _;
        })
        .replace(/&#x([\da-f]+);?/gi, (_, code) => {
            const number = Number.parseInt(code, 16);
            return Number.isFinite(number) ? String.fromCodePoint(Math.min(number, 0x10ffff)) : _;
        })
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'");
}

function htmlToText(html) {
    return decodeHtmlEntities(String(html || '')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(script|style|noscript|template|svg)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6]|section|article|main|tr|header|footer)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' '))
        .replace(/[ \t\f\r]+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function extractTitle(html, fallbackUrl) {
    const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = match ? htmlToText(match[1]) : '';
    return title || new URL(fallbackUrl).hostname;
}

function contentTypeOf(response) {
    return normalizeText(response.headers.get('content-type')).split(';')[0].toLowerCase();
}

function classifySource(hostname) {
    if (hostMatchesRule(hostname, 'gov.cn') || hostMatchesRule(hostname, 'mnr.gov.cn') || hostMatchesRule(hostname, 'dnr.yn.gov.cn') || hostMatchesRule(hostname, 'yn.gov.cn') || hostMatchesRule(hostname, 'km.gov.cn')) {
        return '政策与规划资料';
    }
    if (hostMatchesRule(hostname, 'arxiv.org') || hostMatchesRule(hostname, 'pmc.ncbi.nlm.nih.gov') || hostMatchesRule(hostname, 'ncbi.nlm.nih.gov') || hostMatchesRule(hostname, 'plos.org') || hostMatchesRule(hostname, 'frontiersin.org') || hostMatchesRule(hostname, 'mdpi.com') || hostMatchesRule(hostname, 'springeropen.com') || hostMatchesRule(hostname, 'copernicus.org')) {
        return '开放论文资料';
    }
    return '已登记公开来源';
}

function trimCache() {
    while (pageCache.size > MAX_CACHE_ENTRIES) {
        pageCache.delete(pageCache.keys().next().value);
    }
}

const webFetchTool = {
    name: 'web_fetch',
    description: '读取政策/规划文献索引中已登记的来源网页，并提取完整公开页面正文供模型引用。仅允许 HTTPS、已登记链接或权威公开站点白名单，不执行脚本。',
    keywords: ['网页', '网址', '链接', '来源', '原文', '政策原文', '文献原文', 'web', 'fetch'],
    priority: 4,
    parameters: {
        type: 'object',
        properties: {
            url: { type: 'string', format: 'uri', description: '政策或开放论文的来源 URL，优先填写 policy_reference_lookup 返回的 sources 链接。' }
        },
        required: ['url']
    },

    async query(args = {}) {
        const requestedUrl = normalizeText(args.url);
        if (!requestedUrl) return { type: 'web_fetch', ok: false, error: 'url 不能为空。' };

        const registeredUrls = await loadRegisteredUrls();
        let url;
        try {
            url = validateUrl(requestedUrl, registeredUrls);
        } catch (error) {
            logger.warn(`[webFetchTool] 来源校验失败: ${error.message}`);
            return { type: 'web_fetch', ok: false, url: requestedUrl, error: error.message };
        }

        const cacheKey = url;
        const cached = pageCache.get(cacheKey);
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
            return { ...cached.data, cached: true };
        }
        pageCache.delete(cacheKey);

        const timeoutMs = parsePositiveInteger(process.env.WEB_FETCH_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 30000);
        logger.info(`[webFetchTool] 读取公开来源: ${new URL(url).hostname}`);

        try {
            const { response, finalUrl, rawBody } = await fetchPage(url, timeoutMs, registeredUrls);
            const contentType = contentTypeOf(response);

            if (contentType === 'application/pdf') {
                return {
                    type: 'web_fetch',
                    ok: true,
                    url,
                    final_url: finalUrl,
                    title: new URL(finalUrl).pathname.split('/').pop() || 'PDF 文献',
                    source_type: classifySource(new URL(finalUrl).hostname),
                    content_type: contentType,
                    fetched_at: new Date().toISOString(),
                    content: '该来源为 PDF 文件，当前网页读取器暂提取页面元信息，未解析 PDF 正文。请优先使用其 HTML 原文页或补充可访问的网页版本。',
                    truncated: false,
                    cached: false
                };
            }

            const isJson = contentType.includes('json');
            const content = isJson
                ? (() => {
                    try { return JSON.stringify(JSON.parse(rawBody), null, 2); } catch { return rawBody; }
                })()
                : (contentType.includes('html') || /<html[\s>]/i.test(rawBody) ? htmlToText(rawBody) : rawBody.trim());
            const title = contentType.includes('html') || /<html[\s>]/i.test(rawBody)
                ? extractTitle(rawBody, finalUrl)
                : new URL(finalUrl).hostname;
            const data = {
                type: 'web_fetch',
                ok: true,
                url,
                final_url: finalUrl,
                title,
                source_type: classifySource(new URL(finalUrl).hostname),
                content_type: contentType || 'text/plain',
                fetched_at: new Date().toISOString(),
                content,
                truncated: false,
                cached: false
            };
            pageCache.set(cacheKey, { cachedAt: Date.now(), data });
            trimCache();
            return data;
        } catch (error) {
            logger.warn(`[webFetchTool] 读取失败: ${error.message}`);
            return { type: 'web_fetch', ok: false, url, error: error.message };
        }
    },

    format(data) {
        const title = '> ### [网页资料读取] web_fetch';
        if (!data?.ok) {
            return [title, '', `> 读取失败：${data?.error || '网页未返回有效内容。'}`, `> 来源: ${data?.url || '—'}`].join('\n');
        }
        return [
            title,
            '',
            `- 标题：${data.title || '—'}`,
            `- 来源: ${data.final_url || data.url || '—'}`,
            `- 资料类型：${data.source_type || '公开来源'}`,
            `- 获取时间：${data.fetched_at || '—'}`,
            '',
            data.content || '网页未提取到正文。',
            '',
            '> 说明：该内容仅作为政策/文献解释层资料，涉及空间数值的结论仍需回指平台业务工具。'
        ].join('\n');
    }
};

registry.register(webFetchTool);
export default webFetchTool;
