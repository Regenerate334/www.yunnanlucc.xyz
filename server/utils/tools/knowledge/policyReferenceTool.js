/**
 * 政策/规划文献索引检索工具 (Policy Reference Lookup Tool)
 * 职责：在“内置可维护政策索引库”中检索条目，返回可引用的权威出处链接。
 *
 * 注意：
 * - 本工具只负责“检索与引用”，不负责替代空间统计工具输出数值结论。
 * - 输出必须包含 sources（URL），避免模型无来源背诵。
 */

import fs from 'fs/promises';
import path from 'path';
import registry from '../../dataSourceRegistry.js';
import logger from '../../../config/logger.js';

const CORPUS_PATH = path.resolve('server/knowledge/corpus/policy_corpus.json');

const DEFAULT_TOP_N = 5;
const MAX_TOP_N = 20;

function normalizeStr(v) {
    return (v ?? '').toString().trim();
}

function normalizeKeywords(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(x => normalizeStr(x)).filter(Boolean);
    const s = normalizeStr(v);
    if (!s) return [];
    return s.split(/[,，\s]+/).map(x => normalizeStr(x)).filter(Boolean);
}

function matchAny(text, needles) {
    const t = normalizeStr(text).toLowerCase();
    if (!t) return false;
    return (needles || []).some(k => k && t.includes(k.toLowerCase()));
}

function normalizeLevel(v) {
    const s = normalizeStr(v).toLowerCase();
    if (!s) return '';
    // 兼容中文输入
    if (s === '国家' || s === 'national') return 'national';
    if (s === '省' || s === '省级' || s === 'province') return 'province';
    if (s === '市' || s === '市级' || s === 'city') return 'city';
    if (s === '县' || s === '县级' || s === 'county') return 'county';
    return s;
}

function parseYear(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
}

function scoreEntry(entry, { region, level, keywords, year, yearRange }) {
    let score = 0;

    const regionNorm = normalizeStr(region);
    const levelNorm = normalizeLevel(level);

    if (regionNorm) {
        if (normalizeStr(entry.region) === regionNorm) score += 6;
        else if (normalizeStr(entry.region).includes(regionNorm) || regionNorm.includes(normalizeStr(entry.region))) score += 3;
    }

    if (levelNorm) {
        if (normalizeLevel(entry.level) === levelNorm) score += 3;
    }

    const kw = keywords || [];
    if (kw.length > 0) {
        const hay = [
            entry.title,
            entry.issuer,
            entry.doc_no,
            entry.summary,
            ...(Array.isArray(entry.keywords) ? entry.keywords : [])
        ].join(' ');
        const hitCount = kw.filter(k => matchAny(hay, [k])).length;
        score += hitCount * 2;
    }

    const y = parseYear(year);
    const yr = Array.isArray(yearRange) ? yearRange.map(parseYear).filter(Number.isFinite) : [];
    const start = yr.length >= 1 ? yr[0] : null;
    const end = yr.length >= 2 ? yr[1] : null;
    const entryYear = parseYear((entry.date || '').slice(0, 4));

    if (y && entryYear && entryYear === y) score += 4;
    if (start && end && entryYear && entryYear >= start && entryYear <= end) score += 4;

    // 额外鼓励：条目带 sources
    if (Array.isArray(entry.sources) && entry.sources.length > 0) score += 1;

    return score;
}

function filterByYear(entry, { year, yearRange }) {
    const entryYear = parseYear((entry.date || '').slice(0, 4));
    if (!entryYear) return true;

    const y = parseYear(year);
    if (y) return entryYear === y;

    const yr = Array.isArray(yearRange) ? yearRange.map(parseYear).filter(Number.isFinite) : [];
    if (yr.length >= 2) {
        return entryYear >= yr[0] && entryYear <= yr[1];
    }
    return true;
}

function filterByRegion(entry, region) {
    const r = normalizeStr(region);
    if (!r) return true;
    const er = normalizeStr(entry.region);
    if (!er) return false;
    // 国家级政策对所有区域查询均可见
    if (er === '全国' || normalizeLevel(entry.level) === 'national') return true;
    return er === r || er.includes(r) || r.includes(er);
}

function filterByLevel(entry, level) {
    const l = normalizeLevel(level);
    if (!l) return true;
    return normalizeLevel(entry.level) === l;
}

function toEntryBrief(entry) {
    return {
        id: entry.id,
        title: entry.title,
        issuer: entry.issuer,
        doc_no: entry.doc_no || '',
        date: entry.date || '',
        level: entry.level,
        region: entry.region,
        keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
        summary: entry.summary || '',
        sources: Array.isArray(entry.sources) ? entry.sources : []
    };
}

const policyReferenceTool = {
    name: 'policy_reference_lookup',
    description: '检索内置“政策/规划文献索引库”，返回可引用条目与来源链接（sources）。当用户问某年重大政策/规划要求/用途管制/红线/耕地保护等解释时优先使用。',
    keywords: ['政策', '规划', '国土空间', '三条控制线', '红线', '耕地', '用途管制', '批复', '公报', '自然资源厅', '规划局', '通知', '意见'],
    priority: 6,
    parameters: {
        type: 'object',
        properties: {
            region: { type: 'string', description: '区域名称，如“云南省”“昆明市”。不传则不过滤。' },
            year: { type: 'integer', description: '目标年份，如 2019。' },
            year_range: { type: 'array', items: { type: 'integer' }, description: '年份区间，如 [2019, 2020]。' },
            keywords: { type: 'array', items: { type: 'string' }, description: '关键词数组，如 ["三条控制线","用途管制"]。' },
            level: { type: 'string', description: '层级：national/province/city/county（也兼容输入“国家/省/市/县”）。' },
            top_n: { type: 'integer', description: '返回条目数量，默认 5，最大 20。' }
        },
        required: []
    },

    async query(args) {
        const region = normalizeStr(args?.region);
        const year = args?.year;
        const year_range = args?.year_range;
        const keywords = normalizeKeywords(args?.keywords);
        const level = normalizeLevel(args?.level);
        const top_n = Math.min(Math.max(parseYear(args?.top_n) || DEFAULT_TOP_N, 1), MAX_TOP_N);

        logger.info(`[policyReferenceTool] region=${region || '-'}, year=${year || '-'}, year_range=${Array.isArray(year_range) ? year_range.join(',') : '-'}, level=${level || '-'}, keywords=${keywords.join('|') || '-'}`);

        try {
            const raw = await fs.readFile(CORPUS_PATH, 'utf-8');
            const corpus = JSON.parse(raw);
            const entries = Array.isArray(corpus) ? corpus : [];

            const filtered = entries
                .filter(e => filterByRegion(e, region))
                .filter(e => filterByLevel(e, level));

            const scored = filtered
                .map(e => ({ e, s: scoreEntry(e, { region, level, keywords, year, yearRange: year_range }) }))
                .sort((a, b) => b.s - a.s);

            const hits = scored
                .filter(x => x.s > 0 || (!region && !level && !keywords.length && !year && !Array.isArray(year_range)))
                .slice(0, top_n)
                .map(x => ({ ...toEntryBrief(x.e), score: x.s }));

            return {
                type: 'policy_reference',
                query: { region: region || null, year: parseYear(year), year_range: Array.isArray(year_range) ? year_range : null, level: level || null, keywords },
                hits
            };
        } catch (err) {
            logger.error(`[policyReferenceTool] 检索失败: ${err.message}`);
            return { type: 'policy_reference', error: err.message, hits: [] };
        }
    },

    format(data) {
        const title = `> ### [政策/规划文献索引] policy_reference_lookup`;
        if (data?.error) {
            return [
                title,
                '',
                `> 检索失败：${data.error}`
            ].join('\n');
        }

        const hits = Array.isArray(data?.hits) ? data.hits : [];
        if (hits.length === 0) {
            return [
                title,
                '',
                '> 未检索到匹配条目。',
                '> 质量约束：在未调用到政策条目时，不允许输出“确定存在某某年某某政策”的断言，只能给出一般性解释假设，并建议补充关键词或扩大年份范围。'
            ].join('\n');
        }

        const lines = [title, ''];
        hits.forEach((h, idx) => {
            lines.push(`#### ${idx + 1}. ${h.title}`);
            lines.push(`- 发布机关：${h.issuer || '—'}`);
            lines.push(`- 文号：${h.doc_no || '—'}`);
            lines.push(`- 日期：${h.date || '—'}`);
            lines.push(`- 层级/区域：${h.level || '—'} / ${h.region || '—'}`);
            lines.push(`- 摘要：${h.summary || '—'}`);
            lines.push(`- 来源: ${(Array.isArray(h.sources) && h.sources.length > 0) ? h.sources.join(' , ') : '—'}`);
            lines.push('');
        });

        lines.push('> *提示：政策条目只用于“解释层”，最终结论仍需回指空间统计工具的数值证据（如 clcd_analysis / spatial_stats_analysis 等）。*');
        return lines.join('\n');
    }
};

registry.register(policyReferenceTool);
export default policyReferenceTool;
