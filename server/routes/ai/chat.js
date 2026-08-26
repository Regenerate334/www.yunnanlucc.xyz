/**
 * AI 对话核心路由 (AI Agent Chat Routes)
 * 职责：处理流式 (SSE) 或同步的自然语言对话请求，支持大语言模型交互。
 *
 * 修改提示：
 * 1. 对话流接口使用了 Server-Sent Events (SSE) 协议，请勿设置常规响应头。
 * 2. 会话上下文 (Context) 及历史消息需要通过中间件装载并在结束时持久化。
 * 3. 若使用 Ollama 或 DeepSeek 客户端，需注意网络超时与降级容灾处理。
 */
import express from 'express';
import { body, validationResult } from 'express-validator';
import { getAgentTools } from '../../utils/ai/core/mcpClientTools.js';
import aiMiddleware from '../../utils/ai/core/aiMiddleware.js';
import pool from '../../config/db.js';
import { createDeepSeekChatCompletion, isDeepSeekOfficialModel, resolveDeepSeekModel } from '../../utils/ai/core/deepseekClient.js';
import logger from '../../config/logger.js';

const router = express.Router();

const toolFileMap = {
  'clcd_analysis': 'clcdTool',
  'dashboard_analysis': 'dashboardTool',
  'spatial_stats_analysis': 'spatialStatsTool',
  'land_transfer_analysis': 'transferTool',
  'weather_query': 'weatherTool',
  'knowledge_query': 'knowledgeQueryTool',
  'knowledge_base_lookup': 'knowledgeTool',
  'knowledge_graph_query': 'knowledgeGraphTool',
  'policy_reference_lookup': 'policyReferenceTool',
  'web_fetch': 'webFetchTool'
};

const getDefaultModel = () => process.env.CHAT_MODEL || process.env.OLLAMA_MODEL || 'deepseek-v4-pro';
const getFallbackModelCandidates = (primaryModel) => {
  // 如果用户选择的是 DeepSeek 官方 API 模型，不允许降级到本地 Ollama 模型。
  // 只有当用户手动选择本地模型时，才在本地模型之间做降级。
  if (isDeepSeekOfficialModel(primaryModel)) {
    return [primaryModel];
  }

  const raw = process.env.OLLAMA_FALLBACK_MODELS || process.env.OLLAMA_FALLBACK_MODEL || '';
  const fallbacks = String(raw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  // If user didn't configure explicit fallbacks, use the default local Ollama model as a safe secondary.
  // This keeps the app usable when cloud providers are throttled/timeout.
  const defaultLocalModel = process.env.OLLAMA_MODEL;
  if (defaultLocalModel) fallbacks.push(String(defaultLocalModel).trim());

  return [primaryModel, ...fallbacks].filter((item, index, arr) => arr.indexOf(item) === index);
};
const getRetryCount = () => {
  const value = Number(process.env.AI_STREAM_RETRY_MAX ?? 1);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 1;
};
const getRetryDelayMs = () => {
  const value = Number(process.env.AI_STREAM_RETRY_DELAY_MS ?? 800);
  return Number.isFinite(value) ? Math.max(100, Math.floor(value)) : 800;
};
const getEnableFallback = () => {
  // Explicit opt-in/out via env always wins.
  if (process.env.AI_STREAM_ENABLE_FALLBACK !== undefined) {
    return String(process.env.AI_STREAM_ENABLE_FALLBACK || 'false').toLowerCase() === 'true';
  }

  // Sensible default: if a local Ollama model is configured, enable fallback automatically.
  // If no local model exists, fallback list will collapse to the primary model anyway.
  return Boolean(process.env.OLLAMA_MODEL);
};
const isNumericOrSpatialQuery = (text = '') => {
  const t = String(text || '');
  if (!t.trim()) return false;
  // 触发条件：TopN/排名/占比/百分比/多少km/多少度/重心/椭圆/扁率/净流入/集中度等
  const patterns = [
    /top\s*\d+/i,
    /第\s*\d+\s*(名|位)/,
    /排名|最大|最小|前\s*\d+|后\s*\d+/,
    /占比|百分比|集中度|头部/,
    /多少\s*(km|公里|千米)|距离|偏移|迁移/,
    /方位角|角度|度/,
    /重心|轨迹|路径/,
    /标准差椭圆|椭圆|扁率|主轴/,
    /净流入|净流出|净转入|净转出/,
    /精确|准确|精准/,
    // 泛化：只要用户明确在问“数据结果/统计口径/变化量”且很可能需要数值支撑，也强制走工具核验
    /数据|统计|结果|多少|变化|增减|净增|净减|对比|趋势/
  ];
  return patterns.some((p) => p.test(t));
};
const extractFirstHttpUrl = (text = '') => {
  const source = String(text || '');
  const markdownUrl = source.match(/\]\(\s*(https?:\/\/[^)\s]+)\s*\)/i)?.[1];
  const plainUrl = source.match(/https?:\/\/[^\s<>"'`]+/i)?.[0];
  const candidate = (markdownUrl || plainUrl || '')
    .replace(/[，。；：！？、）》】]+$/u, '');
  if (!candidate) return '';

  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
};
const extractSourceUrls = (text = '') => {
  const candidates = String(text || '').match(/https?:\/\/[^\s<>"'`，。；：！？、）》】]+/gi) || [];
  const urls = candidates.map((candidate) => {
    const cleaned = candidate.replace(/[)\]}>,.;:!?，。；：！？、）》】]+$/u, '');
    try {
      const parsed = new URL(cleaned);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
    } catch {
      return '';
    }
  }).filter(Boolean);
  return [...new Set(urls)];
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const createEmptyStreamError = (modelName) => {
  const err = new Error(`模型 ${modelName} 未返回有效文本内容`);
  err.code = 'EMPTY_STREAM_RESPONSE';
  return err;
};
const isRetryableError = (err) => {
  const msg = (err?.message || String(err)).toLowerCase();
  const keywords = [
    'eof',
    'fetch failed',
    'socket hang up',
    'etimedout',
    'timeout',
    'econnreset',
    'econnrefused',
    '524',
    '503',
    '502',
    '504',
    'connection reset',
    'temporarily unavailable'
  ];
  return (
    err?.code === 'EMPTY_STREAM_RESPONSE'
    || err?.code === 'DEEPSEEK_REQUEST_TIMEOUT'
    || err?.status === 524
    || keywords.some((k) => msg.includes(k))
  );
};
const normalizeRole = (role) => {
  if (!role) return null;
  const value = String(role).toLowerCase();
  if (value === 'user' || value === 'assistant') return value;
  return null;
};
const stripInternalTags = (text, preserveBoundaryWhitespace = false) => {
  if (!text) return '';
  let content = String(text)
    .replace(/[｜]/g, '|')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[＜]/g, '<')
    .replace(/[＞]/g, '>')
    // map_control 已下线，但历史数据中仍可能存在该标记：继续清理以避免污染上下文
    .replace(/\[\[MAP_COMMAND:.*?\]\]/g, '')
    .replace(/^\[(?:SEARCH|ANALYSIS)\].*$/gim, '');

  // Some model families may leak tool-call protocol markers into plain text.
  // These are never meant for end users; keep them out of the conversation memory.
  const dsmlIndex = content.search(/<\|+\s*DSML/i);
  if (dsmlIndex >= 0) content = content.slice(0, dsmlIndex);
  return preserveBoundaryWhitespace ? content : content.trim();
};
const parseJsonLoose = (text = '') => {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const jsonLike = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/)?.[0];
    if (!jsonLike) return null;
    try {
      return JSON.parse(jsonLike);
    } catch {
      return null;
    }
  }
};
const parseToolArguments = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const normalizeSmartPunctuation = (text = '') => {
  if (!text) return '';
  return String(text)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[｜]/g, '|')
    .replace(/[＜]/g, '<')
    .replace(/[＞]/g, '>');
};

const extractDsmlToolCalls = (rawText = '', round = 0) => {
  const text = normalizeSmartPunctuation(rawText);
  // DSML markers may be truncated in streaming chunks (missing a trailing ">"),
  // so we detect start token without requiring the closing angle bracket.
  const startIdx = text.search(/<\|+\s*DSML\s*\|+\s*tool_calls\b/i);
  if (startIdx < 0) return { content: rawText, tool_calls: [] };

  // Keep any leading plain text before DSML as assistant content; DSML block becomes tool_calls.
  const leading = text.slice(0, startIdx).trim();

  const tool_calls = [];

  // Parse each invoke block.
  const invokeRe = /<\|+\s*DSML\s*\|+\s*invoke\s+name\s*=\s*"([^"]+)"\s*>[\s\S]*?<\/\|+\s*DSML\s*\|+\s*invoke\s*>/gi;
  let invokeMatch;
  let invokeIndex = 0;
  while ((invokeMatch = invokeRe.exec(text)) !== null) {
    const toolName = String(invokeMatch[1] || '').trim();
    if (!toolName) continue;

    const invokeBlock = invokeMatch[0] || '';
    const args = {};

    // Parse parameters inside this invoke.
    const paramRe = /<\|+\s*DSML\s*\|+\s*parameter\s+name\s*=\s*"([^"]+)"\s+string\s*=\s*"([^"]+)"\s*>([\s\S]*?)<\/\|+\s*DSML\s*\|+\s*parameter\s*>/gi;
    let paramMatch;
    while ((paramMatch = paramRe.exec(invokeBlock)) !== null) {
      const key = String(paramMatch[1] || '').trim();
      const isString = String(paramMatch[2] || '').trim().toLowerCase() === 'true';
      const valueRaw = String(paramMatch[3] ?? '').trim();
      if (!key) continue;

      if (isString) {
        args[key] = valueRaw;
        continue;
      }

      // Non-string values are JSON-encoded per DSML spec; parse best-effort.
      try {
        args[key] = JSON.parse(valueRaw);
      } catch {
        // Fallback: keep raw string so tool can still attempt to coerce.
        args[key] = valueRaw;
      }
    }

    tool_calls.push({
      index: invokeIndex,
      id: `dsml_call_${round}_${invokeIndex}`,
      type: 'function',
      function: {
        name: toolName,
        arguments: JSON.stringify(args)
      }
    });
    invokeIndex += 1;
  }

  return {
    content: leading,
    tool_calls
  };
};

const serializeToolOutput = (output) => {
  if (typeof output === 'string') return output;
  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
};

const TRACE_SCOPE_REGION_NAMES = [
  '云南省', '云南全省', '全云南',
  '昆明市', '曲靖市', '玉溪市', '保山市', '昭通市', '丽江市', '普洱市', '临沧市',
  '楚雄彝族自治州', '红河哈尼族彝族自治州', '文山壮族苗族自治州',
  '西双版纳傣族自治州', '大理白族自治州', '德宏傣族景颇族自治州',
  '怒江傈僳族自治州', '迪庆藏族自治州',
  '楚雄州', '红河州', '文山州', '西双版纳州', '大理州', '德宏州', '怒江州', '迪庆州',
  '全国'
];

const normalizeTraceScopeRegion = (value) => {
  const values = Array.isArray(value) ? value : [value];
  const regions = values
    .flatMap((item) => String(item ?? '').split(/[,，、]/))
    .map((item) => item.trim())
    .filter((item) => item && !/^(?:auto|all|目标区域|目标城市|当前区域|未指定)$/i.test(item))
    .map((item) => /^(?:云南全省|全云南|全省)$/.test(item) ? '云南省' : item);
  return [...new Set(regions)].join('、');
};

const normalizeTraceScopeYear = (value) => {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
};

const normalizeTraceScopeYearRange = (value) => {
  let candidates = [];
  if (Array.isArray(value)) {
    candidates = value;
  } else if (typeof value === 'string') {
    candidates = value.match(/(?:19|20)\d{2}/g) || [];
  }
  const years = candidates.map(normalizeTraceScopeYear).filter(Number.isInteger);
  if (years.length < 2) return null;
  return [Math.min(years[0], years[1]), Math.max(years[0], years[1])];
};

const extractExplicitTraceScope = (question = '') => {
  const source = String(question || '').replace(/https?:\/\/[^\s<>'"`]+/gi, ' ');
  if (!source.trim()) return {};

  const rangeMatch = source.match(/((?:19|20)\d{2})\s*年?\s*(?:—|–|-|~|～|至|到)\s*((?:19|20)\d{2})\s*年?/);
  const yearRange = rangeMatch
    ? normalizeTraceScopeYearRange([rangeMatch[1], rangeMatch[2]])
    : null;
  const explicitYears = source.match(/(?:19|20)\d{2}/g) || [];
  const year = !yearRange && explicitYears.length === 1
    ? normalizeTraceScopeYear(explicitYears[0])
    : null;

  const namedRegions = TRACE_SCOPE_REGION_NAMES
    .filter((name) => source.includes(name))
    .filter((name, index, all) => !all.some((other, otherIndex) => (
      otherIndex !== index && other.length > name.length && other.includes(name) && source.includes(other)
    )));

  const featureMatch = source.match(/(?:请|帮我|分析|研究|评价|评估|查询|检索|统计|对比|比较|说明|查看|关于|针对)?\s*([\u4e00-\u9fa5A-Za-z0-9·]{2,24}(?:水电站|流域|坝区|库区|保护区|开发区))/);
  if (!namedRegions.length && featureMatch?.[1]) {
    const feature = featureMatch[1].replace(/^(?:请|帮我|分析|研究|评价|评估|查询|检索|统计|对比|比较|说明|查看|关于|针对)+/, '');
    const featureTail = source.slice((featureMatch.index || 0) + featureMatch[0].length);
    // 含关系连接词的长短语通常是任务描述而非地名，宁可不展示也不猜测范围。
    if (feature && !/[的对与和及在从为]/.test(feature)) {
      namedRegions.push(`${feature}${/^(?:建设)?(?:对)?(?:其)?(?:周边区域|周边|附近|影响区)/.test(featureTail) ? '周边区域' : ''}`);
    }
  }

  return {
    ...(namedRegions.length ? { region: normalizeTraceScopeRegion(namedRegions) } : {}),
    ...(yearRange ? { year_range: yearRange } : {}),
    ...(year ? { year } : {})
  };
};

const extractToolTraceScope = (plannedCalls = []) => {
  const regions = [];
  const ranges = [];
  const years = [];

  plannedCalls.forEach((call) => {
    const parameters = call?.parameters && typeof call.parameters === 'object'
      ? call.parameters
      : {};
    const region = normalizeTraceScopeRegion(parameters.region || parameters.regions || parameters.city);
    if (region) regions.push(...region.split('、'));

    const directRange = normalizeTraceScopeYearRange(parameters.year_range);
    const snakeRange = normalizeTraceScopeYearRange([parameters.start_year, parameters.end_year]);
    const camelRange = normalizeTraceScopeYearRange([parameters.yearStart, parameters.yearEnd]);
    const periodRange = normalizeTraceScopeYearRange(parameters.period);
    const range = directRange || snakeRange || camelRange || periodRange;
    if (range) {
      ranges.push(range);
      return;
    }

    const year = normalizeTraceScopeYear(parameters.year);
    if (year) years.push(year);
  });

  const uniqueRegions = [...new Set(regions)];
  const uniqueYears = [...new Set(years)].sort((a, b) => a - b);
  const scope = {};
  if (uniqueRegions.length) scope.region = uniqueRegions.join('、');
  if (ranges.length) {
    scope.year_range = [
      Math.min(...ranges.map((range) => range[0])),
      Math.max(...ranges.map((range) => range[1]))
    ];
  } else if (uniqueYears.length === 1) {
    scope.year = uniqueYears[0];
  } else if (uniqueYears.length > 1) {
    scope.years = uniqueYears;
  }
  return scope;
};

const hasTraceScope = (scope = {}) => Boolean(
  scope.region
  || normalizeTraceScopeYear(scope.year)
  || normalizeTraceScopeYearRange(scope.year_range)
  || (Array.isArray(scope.years) && scope.years.some((year) => normalizeTraceScopeYear(year)))
);

const hasTraceScopeTime = (scope = {}) => Boolean(
  normalizeTraceScopeYear(scope.year)
  || normalizeTraceScopeYearRange(scope.year_range)
  || (Array.isArray(scope.years) && scope.years.some((year) => normalizeTraceScopeYear(year)))
);

const mergeTraceScopes = (questionScope = {}, toolScope = {}) => {
  const scope = {};
  const questionHasTime = hasTraceScopeTime(questionScope);
  const region = questionScope.region || toolScope.region;
  if (region) scope.region = region;

  const timeSource = questionHasTime ? questionScope : toolScope;
  if (normalizeTraceScopeYearRange(timeSource.year_range)) {
    scope.year_range = normalizeTraceScopeYearRange(timeSource.year_range);
  } else if (Array.isArray(timeSource.years) && timeSource.years.length) {
    scope.years = [...new Set(timeSource.years.map(normalizeTraceScopeYear).filter(Number.isInteger))];
  } else if (normalizeTraceScopeYear(timeSource.year)) {
    scope.year = normalizeTraceScopeYear(timeSource.year);
  }

  const fromQuestion = Boolean(questionScope.region || questionHasTime);
  const fromTool = Boolean(
    (!questionScope.region && toolScope.region)
    || (!questionHasTime && hasTraceScopeTime(toolScope))
  );
  if (fromQuestion || fromTool) {
    scope.scope_source = fromQuestion && fromTool ? 'question+tool' : (fromQuestion ? 'question' : 'tool');
  }
  return scope;
};

const formatTraceScope = (scope = {}) => {
  const parts = [];
  if (scope.region) parts.push(scope.region);
  const yearRange = normalizeTraceScopeYearRange(scope.year_range);
  if (yearRange) {
    parts.push(`${yearRange[0]}—${yearRange[1]}年`);
  } else if (Array.isArray(scope.years) && scope.years.length) {
    const years = scope.years.map(normalizeTraceScopeYear).filter(Number.isInteger);
    if (years.length) parts.push(`${years.join('、')}年`);
  } else if (normalizeTraceScopeYear(scope.year)) {
    parts.push(`${normalizeTraceScopeYear(scope.year)}年`);
  }
  return parts.join('、');
};

const TRACE_SENSITIVE_KEY_RE = /(?:api[_-]?key|token|password|passwd|secret|authorization|cookie|session[_-]?id|private[_-]?key|database[_-]?url)/i;
const TRACE_MAX_STRING_CHARS = 1200;
const TRACE_MAX_ARRAY_ITEMS = 24;
const TRACE_MAX_OBJECT_KEYS = 48;
const TRACE_MAX_DEPTH = 6;
const TRACE_OBSERVATION_MAX_CHARS = Math.max(2000, Number(process.env.AI_TRACE_OBSERVATION_MAX_CHARS || 12000));
const TRACE_REASONING_EVENT_MAX_CHARS = Math.max(4000, Number(process.env.AI_TRACE_REASONING_EVENT_MAX_CHARS || 32000));
const TRACE_REASONING_TOTAL_MAX_CHARS = Math.max(
  TRACE_REASONING_EVENT_MAX_CHARS,
  Number(process.env.AI_TRACE_REASONING_TOTAL_MAX_CHARS || process.env.AI_TRACE_REASONING_MAX_CHARS || 160000)
);
const TRACE_REASONING_TRUNCATION_MARKER = '\n\n[模型推理记录已按安全边界截断]';

const redactTraceText = (value = '') => String(value || '')
  .replace(/(bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
  .replace(/(postgres(?:ql)?:\/\/[^:\s/@]+:)[^@\s/]+@/gi, '$1[REDACTED]@')
  .replace(/((?:api[_-]?key|token|password|passwd|secret|authorization|cookie|database[_-]?url)\s*[:=]\s*)[^,;\s"']+/gi, '$1[REDACTED]');

const sanitizeTraceValue = (value, depth = 0, options = {}) => {
  const maxStringChars = Math.max(64, Number(options.maxStringChars || TRACE_MAX_STRING_CHARS));
  const markTruncated = () => {
    if (options.truncationState) options.truncationState.value = true;
  };
  if (depth > TRACE_MAX_DEPTH) {
    markTruncated();
    return '[DEPTH_LIMIT]';
  }
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    const safe = redactTraceText(value);
    if (safe.length > maxStringChars) {
      markTruncated();
      return `${safe.slice(0, maxStringChars)}\n...[STRING_TRUNCATED]`;
    }
    return safe;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const visible = value.slice(0, TRACE_MAX_ARRAY_ITEMS)
      .map((item) => sanitizeTraceValue(item, depth + 1, options));
    if (value.length > TRACE_MAX_ARRAY_ITEMS) {
      markTruncated();
      visible.push(`[...OMITTED ${value.length - TRACE_MAX_ARRAY_ITEMS} ITEMS]`);
    }
    return visible;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    const safe = {};
    entries.slice(0, TRACE_MAX_OBJECT_KEYS).forEach(([key, item]) => {
      safe[key] = TRACE_SENSITIVE_KEY_RE.test(key)
        ? '[REDACTED]'
        : sanitizeTraceValue(item, depth + 1, options);
    });
    if (entries.length > TRACE_MAX_OBJECT_KEYS) {
      markTruncated();
      safe.__truncated_keys__ = entries.length - TRACE_MAX_OBJECT_KEYS;
    }
    return safe;
  }
  return redactTraceText(String(value));
};

const tryParseTraceJson = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const summarizeTraceText = (value = '', maxChars = 260) => {
  const safe = redactTraceText(value)
    .replace(/```[a-z]*|```/gi, ' ')
    .replace(/[#*_`>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!safe) return '工具未返回可展示的数据摘要。';
  return safe.length > maxChars ? `${safe.slice(0, maxChars)}...` : safe;
};

const buildObservationTrace = (output) => {
  const parsed = tryParseTraceJson(output);
  let originalChars = 0;
  try {
    originalChars = (typeof parsed === 'string' ? parsed : JSON.stringify(parsed)).length;
  } catch {
    originalChars = String(parsed ?? '').length;
  }
  const truncationState = { value: false };
  const safeValue = sanitizeTraceValue(parsed, 0, {
    maxStringChars: TRACE_OBSERVATION_MAX_CHARS,
    truncationState
  });
  let preview;
  try {
    preview = typeof safeValue === 'string' ? safeValue : JSON.stringify(safeValue, null, 2);
  } catch {
    preview = redactTraceText(String(safeValue));
  }

  const previewTooLong = preview.length > TRACE_OBSERVATION_MAX_CHARS;
  const truncated = truncationState.value || previewTooLong;
  if (previewTooLong) {
    const omittedChars = Math.max(0, preview.length - TRACE_OBSERVATION_MAX_CHARS);
    preview = `${preview.slice(0, TRACE_OBSERVATION_MAX_CHARS)}\n... [OBSERVATION_TRUNCATED ${omittedChars} CHARS]`;
  } else if (truncationState.value) {
    preview = `${preview}\n... [OBSERVATION_STRUCTURE_TRUNCATED]`;
  }

  let summary = '';
  if (safeValue && typeof safeValue === 'object' && !Array.isArray(safeValue)) {
    const facts = Object.entries(safeValue).slice(0, 8).map(([key, item]) => {
      if (Array.isArray(item)) return `${key}: ${item.length} 条`;
      if (item && typeof item === 'object') return `${key}: ${Object.keys(item).slice(0, 5).join('/') || '对象'}`;
      return `${key}: ${summarizeTraceText(String(item ?? ''), 48)}`;
    });
    summary = facts.join('；');
  } else if (Array.isArray(safeValue)) {
    summary = `返回 ${safeValue.length} 条记录。`;
  } else {
    summary = summarizeTraceText(String(safeValue || ''));
  }

  return {
    summary: summary || '工具执行完成，结果已回灌给模型。',
    preview,
    format: typeof safeValue === 'string' ? 'text' : 'json',
    truncated,
    original_chars: originalChars
  };
};

const summarizeReasoningForTrace = (reasoning = '', toolNames = []) => {
  const summary = summarizeTraceText(reasoning, 320);
  if (toolNames.length === 0) return summary;
  return `${summary} 规划调用：${toolNames.join('、')}。`;
};

const createReasoningTraceBudget = () => ({
  maxChars: TRACE_REASONING_TOTAL_MAX_CHARS,
  chars: 0,
  truncated: false,
  markerEmitted: false
});

const takeReasoningTraceChunk = (value, budget, maxChunkChars = Number.POSITIVE_INFINITY) => {
  const raw = String(value || '');
  if (!raw) return '';
  const remaining = Math.max(0, budget.maxChars - budget.chars);
  const allowed = Math.min(remaining, maxChunkChars);
  if (allowed <= 0) {
    budget.truncated = true;
    return '';
  }
  const safe = redactTraceText(raw).slice(0, allowed);
  budget.chars += safe.length;
  if (safe.length < raw.length) budget.truncated = true;
  return safe;
};

const emitReasoningTraceMarker = (emit, budget) => {
  if (!budget.truncated || budget.markerEmitted || typeof emit !== 'function') return;
  budget.markerEmitted = true;
  emit(TRACE_REASONING_TRUNCATION_MARKER);
};

const getToolFailureMessage = (output) => {
  if (typeof output === 'string') {
    const match = output.trim().match(/^(?:工具调用|[^\n]{0,40}(?:查询|分析|执行))失败\s*[:：]\s*(.*)$/s);
    return match ? (match[1] || match[0]).trim() : '';
  }
  if (output && typeof output === 'object' && (output.success === false || output.error)) {
    return String(output.error || '工具返回失败状态');
  }
  return '';
};

async function streamDeepSeekResponse(response, res, {
  onReasoningDelta,
  reasoningBudget = createReasoningTraceBudget(),
  emitContent = true
} = {}) {
  const reader = response.body?.getReader();
  if (!reader) return { chunkCount: 0, content: '', reasoningContent: '', finishReason: '' };

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let chunkCount = 0;
  let streamedContent = '';
  let streamedReasoning = '';
  let finishReason = '';
  // Maintain a small rolling window so we can detect DSML markers across chunk boundaries.
  let pendingContent = '';
  let dsmlSuppressed = false;

  const processEvent = (json) => {
    const choice = json?.choices?.[0] || {};
    const delta = choice.delta || {};
    if (choice.finish_reason) finishReason = choice.finish_reason;

    // DeepSeek thinking mode streams reasoning_content separately from content.
    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
      streamedReasoning += delta.reasoning_content;
      const safeReasoning = takeReasoningTraceChunk(delta.reasoning_content, reasoningBudget);
      if (safeReasoning) {
        writeSSE(res, { thinking: safeReasoning });
        onReasoningDelta?.(safeReasoning);
      }
    }

    if (typeof delta.content !== 'string' || !delta.content || dsmlSuppressed) return;

    pendingContent += delta.content;
    const normalized = normalizeSmartPunctuation(pendingContent);
    const dsmlIndex = normalized.search(/<\|+\s*DSML/i);
    if (dsmlIndex >= 0) {
      // Flush safe prefix before DSML, then suppress the protocol payload.
      const safePrefix = pendingContent.slice(0, dsmlIndex);
      const safeOut = stripInternalTags(safePrefix, true);
      if (safeOut) {
        chunkCount++;
        streamedContent += safeOut;
        if (emitContent) writeSSE(res, { content: safeOut });
      }
      pendingContent = '';
      dsmlSuppressed = true;
      return;
    }

    // Keep a short tail for protocol-marker detection while preserving all whitespace.
    if (pendingContent.length >= 256) {
      const keepTail = 64;
      const flushText = pendingContent.slice(0, pendingContent.length - keepTail);
      const safeOut = stripInternalTags(flushText, true);
      if (safeOut) {
        chunkCount++;
        streamedContent += safeOut;
        if (emitContent) writeSSE(res, { content: safeOut });
      }
      pendingContent = pendingContent.slice(-keepTail);
    }
  };

  while (true) {
    if (res.writableEnded || res.destroyed) {
      await reader.cancel().catch(() => {});
      break;
    }
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try { processEvent(JSON.parse(data)); } catch { /* ignore malformed SSE lines */ }
    }
  }

  // A provider may close the stream without a final newline. Do not lose that last event.
  buffer += decoder.decode();
  const trailing = buffer.trim();
  if (trailing.startsWith('data:')) {
    const data = trailing.slice(5).trim();
    if (data && data !== '[DONE]') {
      try { processEvent(JSON.parse(data)); } catch { /* ignore incomplete trailing data */ }
    }
  }

  // Flush remaining pending content if DSML never started.
  if (!dsmlSuppressed && pendingContent) {
    const safeOut = stripInternalTags(pendingContent, true);
    if (safeOut) {
      chunkCount++;
      streamedContent += safeOut;
      if (emitContent) writeSSE(res, { content: safeOut });
    }
  }

  emitReasoningTraceMarker((marker) => {
    writeSSE(res, { thinking: marker });
    onReasoningDelta?.(marker);
  }, reasoningBudget);

  return { chunkCount, content: streamedContent, reasoningContent: streamedReasoning, finishReason };
}

const removeContinuationOverlap = (previous = '', continuation = '') => {
  if (!continuation) return '';
  if (!previous) return continuation;
  if (previous.endsWith(continuation)) return '';

  const maxOverlap = Math.min(previous.length, continuation.length, 16000);
  for (let size = maxOverlap; size >= 32; size--) {
    if (previous.slice(-size) === continuation.slice(0, size)) {
      return continuation.slice(size);
    }
  }
  return continuation;
};

const normalizeOllamaHost = (host) => String(host || 'http://127.0.0.1:11434').replace(/\/$/, '');

async function requestOllamaChat({
  host,
  model,
  messages,
  stream = false,
  options = {},
  format,
  think
}) {
  const base = normalizeOllamaHost(host);
  const payload = {
    model,
    messages,
    stream: !!stream,
    options: options && typeof options === 'object' ? options : undefined
  };
  if (format) payload.format = format;
  if (think !== undefined) payload.think = think;

  const response = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const err = new Error(text || `Ollama API ${response.status}`);
    err.status = response.status;
    throw err;
  }

  return stream ? response : response.json();
}

async function streamOllamaResponseToSSE(response, res) {
  const reader = response.body?.getReader();
  if (!reader) return 0;

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let chunkCount = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let json;
      try {
        json = JSON.parse(trimmed);
      } catch {
        continue;
      }

      const msg = json?.message || {};
      if (typeof msg.thinking === 'string' && msg.thinking) {
        writeSSE(res, { thinking: msg.thinking });
      }
      if (typeof msg.content === 'string' && msg.content) {
        chunkCount++;
        writeSSE(res, { content: msg.content });
      }
    }
  }

  // Process trailing buffer (best-effort)
  const trailing = buffer.trim();
  if (trailing) {
    try {
      const json = JSON.parse(trailing);
      const msg = json?.message || {};
      if (typeof msg.thinking === 'string' && msg.thinking) writeSSE(res, { thinking: msg.thinking });
      if (typeof msg.content === 'string' && msg.content) {
        chunkCount++;
        writeSSE(res, { content: msg.content });
      }
    } catch {
      // ignore
    }
  }

  return chunkCount;
}

async function consumeDeepSeekStreamToMessage(response, {
  onReasoningDelta,
  reasoningBudget = createReasoningTraceBudget(),
  shouldAbort = () => false
} = {}) {
  const reader = response.body?.getReader();
  if (!reader) return { content: '', reasoning_content: '', tool_calls: [] };

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  let content = '';
  let reasoningContent = '';
  let reasoningPending = '';

  const flushReasoningTrace = (force = false) => {
    if (typeof onReasoningDelta !== 'function' || !reasoningPending) return;
    if (!force && reasoningPending.length < 240) return;
    const keepTail = force ? 0 : 96;
    const emitRaw = keepTail > 0 ? reasoningPending.slice(0, -keepTail) : reasoningPending;
    reasoningPending = keepTail > 0 ? reasoningPending.slice(-keepTail) : '';
    if (!emitRaw) return;

    const safeChunk = takeReasoningTraceChunk(emitRaw, reasoningBudget);
    if (safeChunk) {
      onReasoningDelta(safeChunk);
    }
  };

  // DeepSeek/OpenAI-style tool_calls streaming: function.arguments may be chunked.
  // We'll aggregate by (index, id) where possible, fallback to index.
  const toolCallMap = new Map();

  while (true) {
    if (shouldAbort()) {
      await reader.cancel().catch(() => {});
      break;
    }
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;

      const json = JSON.parse(data);
      const delta = json.choices?.[0]?.delta || {};

      if (delta.content) content += delta.content;
      if (delta.reasoning_content) {
        reasoningContent += delta.reasoning_content;
        reasoningPending += delta.reasoning_content;
        flushReasoningTrace(false);
      }

      const deltaToolCalls = delta.tool_calls || [];
      for (const tc of deltaToolCalls) {
        // In streaming mode, `id` / `function.name` may only appear in the first chunk,
        // while later chunks only contain `index` + partial `function.arguments`.
        // So `index` is the most stable aggregation key.
        const key = String(tc.index ?? 0);
        const prev = toolCallMap.get(key) || {
          index: tc.index ?? 0,
          id: tc.id,
          type: tc.type || 'function',
          function: {
            name: tc.function?.name,
            arguments: ''
          }
        };

        if (tc.id) prev.id = tc.id;
        if (tc.function?.name) prev.function.name = tc.function.name;
        if (typeof tc.function?.arguments === 'string') prev.function.arguments += tc.function.arguments;

        toolCallMap.set(key, prev);
      }
    }
  }

  flushReasoningTrace(true);
  emitReasoningTraceMarker(onReasoningDelta, reasoningBudget);

  const tool_calls = Array.from(toolCallMap.values())
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((tc) => ({
      index: tc.index,
      id: tc.id || `call_${tc.index ?? 0}`,
      type: tc.type || 'function',
      function: {
        name: tc.function?.name,
        arguments: tc.function?.arguments || ''
      }
    }));

  return {
    content,
    reasoning_content: reasoningContent,
    tool_calls: tool_calls.filter((tc) => tc.function?.name),
    reasoning_trace_truncated: reasoningBudget.truncated
  };
}

async function runOllamaStructuredToolLoop({
  res,
  model,
  systemPrompt,
  chatHistoryBase,
  lastUserMsg,
  toolTitleMap,
  toolArchitectureEndMap,
  llmHost,
  thinkingEnabled = true
}) {
  const agentTools = await getAgentTools();
  const baseMessages = [
    { role: 'system', content: systemPrompt },
    ...chatHistoryBase,
    { role: 'user', content: lastUserMsg }
  ];

  const toolByName = new Map(agentTools.map((tool) => [tool.metadata.name, tool]));
  const maxToolRounds = 4;
  let usedTools = false;
  const mustUseTools = isNumericOrSpatialQuery(lastUserMsg);

  // Simple schema: keep it permissive (string/object/string) and validate ourselves.
  const plannerSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      kind: { type: 'string', description: 'tool 或 final' },
      tool_name: { type: 'string', description: '当 kind=tool 时填写工具名，否则留空字符串' },
      arguments: { type: 'object', description: '工具参数对象；当 kind=final 时为空对象 {}' },
      answer: { type: 'string', description: '当 kind=final 时填写最终答案，否则留空字符串' }
    },
    required: ['kind', 'tool_name', 'arguments', 'answer']
  };
  const schemaText = JSON.stringify(plannerSchema, null, 2);
  const toolCatalog = agentTools
    .map((tool) => `- ${tool.metadata.name}: ${tool.metadata.description}`)
    .join('\n');
  const plannerSuffix = `\n\n【工具调度协议（重要）】\n你现在处于“工具调度”阶段，只能输出一个 JSON 对象，禁止输出任何其它文本或 Markdown。\n输出必须符合以下 JSON Schema：\n${schemaText}\n\n可用工具如下：\n${toolCatalog}\n\n规则：\n1) 如果需要查询/计算数据，kind 必须是 \"tool\"，tool_name 必须从上面的工具名中选一个，arguments 必须是 JSON 对象。\n2) 如果可以直接给出最终分析结论，kind 必须是 \"final\"，answer 填写最终中文回答（Markdown 可用），tool_name 置空字符串，arguments 置为 {}。\n`;

  const messages = [...baseMessages];

  for (let round = 0; round < maxToolRounds; round++) {
    writeWorkflow(res, {
      id: `ollama_tool_plan_${round}`,
      label: 'Ollama 结构化调度 → 解析意图并规划分析路径',
      type: 'analysis',
      iconKey: 'brain',
      done: false
    });

    const plannerMessages = messages.map((m, idx) => {
      if (idx === 0 && m.role === 'system') {
        return { ...m, content: `${m.content}${plannerSuffix}` };
      }
      return m;
    });

    const planning = await requestOllamaChat({
      host: llmHost,
      model,
      messages: plannerMessages,
      stream: false,
      format: plannerSchema,
      options: { temperature: 0 }
    });

    const raw = planning?.message?.content || '';
    const decision = parseJsonLoose(raw);
    const kind = String(decision?.kind || '').trim().toLowerCase();
    const requiresLocalToolRetry = kind === 'final' && !usedTools && mustUseTools;
    writeWorkflow(res, {
      id: `ollama_tool_plan_${round}`,
      label: kind === 'tool'
        ? `本地模型 → 确定第 ${round + 1} 轮工具调用路径`
        : (requiresLocalToolRetry
            ? `本地模型 → 复核第 ${round + 1} 轮证据充分性`
            : `本地模型 → 完成第 ${round + 1} 轮分析决策`),
      type: 'analysis',
      iconKey: 'brain',
      done: true
    });

    if (kind === 'final') {
      const answer = String(decision?.answer || '').trim();
      if (!answer) break;

      // Enforce: every user turn must be grounded by at least one real tool call.
      // If the model tries to return a final answer before any tool usage, force a re-plan.
      if (requiresLocalToolRetry) {
        messages.push({
          role: 'user',
          content: 'Observation: 你尚未调用任何业务工具获取或核验数据。请先选择一个合适的工具进行检索/计算，然后再输出最终结论。'
        });
        continue;
      }

      writeSSE(res, { content: answer });
      return answer.length;
    }

    if (kind !== 'tool') {
      // If the model returns an unexpected kind, stop tool loop and let final generation handle it.
      break;
    }

    const toolName = String(decision?.tool_name || '').trim();
    const tool = toolByName.get(toolName);
    const args = decision?.arguments && typeof decision.arguments === 'object' ? decision.arguments : {};

    usedTools = true;

    if (!tool) {
      const obs = `Observation (${toolName || 'unknown_tool'}): 工具不存在。可用工具: ${Array.from(toolByName.keys()).join(', ')}`;
      messages.push({ role: 'user', content: obs });
      continue;
    }

    const statusText = toolTitleMap[toolName] ? toolTitleMap[toolName](args) : `正在运行业务组件: ${toolName}...`;
    const toolSourceLabel = tool.metadata?.source === 'mcp' ? 'MCP Client → tools/call' : 'agentTools fallback';
    writeWorkflow(res, {
      id: `tool_${round}_${toolName}`,
      label: `${toolSourceLabel} → 调用 ${toolFileMap[toolName] || toolName + 'Tool'} | ${statusText}`,
      type: 'search',
      iconKey: 'tool',
      done: false
    });

    let output;
    try {
      output = await tool.call(args);
    } catch (err) {
      output = `工具调用失败: ${err.message || String(err)}`;
    }

    writeWorkflow(res, {
      id: `tool_${round}_${toolName}`,
      label: `${toolFileMap[toolName] || toolName + 'Tool'} → ${toolArchitectureEndMap[toolName] || '调度执行完成'}`,
      type: 'analysis',
      iconKey: 'check',
      done: true
    });

    // map_control 已下线：不再透传 MAP_COMMAND 指令

    // Keep an Observation message to help local models stay consistent.
    const obs = `Observation (${toolName}): ${serializeToolOutput(output)}`;
    messages.push({ role: 'user', content: obs });
  }

  writeWorkflow(res, {
    id: 'ollama_final',
    label: 'Ollama LLM → 基于工具结果生成最终答案',
    type: 'analysis',
    iconKey: 'analysis',
    done: false
  });

  const finalResponse = await requestOllamaChat({
    host: llmHost,
    model,
    messages,
    stream: true,
    options: { temperature: 0.1 },
    think: !!thinkingEnabled
  });

  const finalChunkCount = await streamOllamaResponseToSSE(finalResponse, res);
  writeWorkflow(res, {
    id: 'ollama_final',
    label: '本地模型 → 完成证据整合与回答生成',
    type: 'analysis',
    iconKey: 'check',
    done: true
  });
  return finalChunkCount;
}
const sanitizeHistoryMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((item) => {
      const role = normalizeRole(item?.role);
      if (!role) return null;
      const content = stripInternalTags(item?.content);

      // DeepSeek V4 thinking-mode tool loops require round-tripping `reasoning_content`
      // across subsequent requests when a turn involved tool calls.
      // Our session storage persists it as `thinking` (front-end field name).
      // Passing it for non-tool turns is safe: the API will ignore it when unnecessary.
      const reasoning_content = (role === 'assistant')
        ? stripInternalTags(item?.reasoning_content || item?.thinking || '')
        : '';

      // Keep tool-only assistant messages (content empty but has reasoning_content) to preserve continuity.
      if (!content && !(role === 'assistant' && reasoning_content)) return null;

      const out = { role, content: content || '' };
      if (role === 'assistant' && reasoning_content) out.reasoning_content = reasoning_content;
      return out;
    })
    .filter(Boolean);
};
// DeepSeek V4 Pro supports a large context window. The application deliberately
// keeps the complete session history and leaves context admission to the provider.
const preserveSessionHistory = (messages) => Array.isArray(messages) ? messages : [];
async function loadSessionHistory(sessionId, userId) {
  if (!sessionId || !userId) return [];
  const { rows } = await pool.query(
    'SELECT messages FROM chat_sessions WHERE id = $1 AND user_id = $2 LIMIT 1',
    [sessionId, userId]
  );
  if (rows.length === 0) return [];
  return sanitizeHistoryMessages(rows[0].messages || []);
}

function writeSSE(res, payload) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  if (typeof res.flush === 'function') res.flush();
}

function writeWorkflow(res, node) {
  writeSSE(res, {
    workflow: {
      type: node.type || 'analysis',
      done: node.done !== false,
      ...node
    }
  });
}

function writeAgentTrace(res, event) {
  if (!event?.id) return;
  const trace = {
    id: String(event.id),
    phase: event.phase || 'system',
    status: event.status || 'completed',
    title: event.title || 'Agent 执行阶段',
    summary: summarizeTraceText(event.summary || '', 360),
    ...(event.detail ? { detail: summarizeTraceText(event.detail, 1800) } : {}),
    ...(event.parameters ? { parameters: sanitizeTraceValue(event.parameters) } : {}),
    ...(event.tool ? { tool: String(event.tool) } : {}),
    ...(event.source ? { source: String(event.source) } : {}),
    ...(event.scope_source ? { scope_source: String(event.scope_source) } : {}),
    ...(event.round !== undefined ? { round: Number(event.round) } : {}),
    ...(event.duration_ms !== undefined ? { duration_ms: Math.max(0, Number(event.duration_ms) || 0) } : {}),
    ...(event.observation ? { observation: event.observation } : {}),
    ...(event.reasoning ? {
      reasoning: redactTraceText(String(event.reasoning)).slice(0, TRACE_REASONING_EVENT_MAX_CHARS)
    } : {}),
    ...(event.error ? { error: summarizeTraceText(event.error, 800) } : {}),
    timestamp: event.timestamp || new Date().toISOString()
  };
  writeSSE(res, { trace });
}

async function writeWorkflowSequence(res, nodes, delayMs = 100) {
  for (const node of nodes) {
    writeWorkflow(res, node);
    await sleep(delayMs);
  }
}

async function runDeepSeekOfficialToolLoop({
  res,
  model,
  systemPrompt,
  chatHistoryBase,
  lastUserMsg,
  toolTitleMap,
  toolArchitectureEndMap,
  thinkingEnabled = false,
  sessionId = null,
  userId = null
}) {
  const agentTools = await getAgentTools();
  const directWebFetchUrl = extractFirstHttpUrl(lastUserMsg);
  const mustFetchWeb = Boolean(directWebFetchUrl);
  const messages = [
    {
      role: 'system',
      content: directWebFetchUrl
        ? `${systemPrompt}\n\n【直接来源读取路由】用户在本轮明确提供了公开网页 URL：${directWebFetchUrl}\n必须调用 \'web_fetch\' 读取该 URL 的正文；不得回答“当前环境不具备访问外部网页的能力”，也不得仅用政策索引摘要替代网页读取。`
        : systemPrompt
    },
    ...chatHistoryBase,
    { role: 'user', content: lastUserMsg }
  ];
  const toolByName = new Map(agentTools.map((tool) => [tool.metadata.name, tool]));
  const toolResultCache = new Map(); // key -> serialized tool output (per request loop)
  const apiModel = resolveDeepSeekModel(model);
  const maxToolRounds = 8;
  let usedTools = false;
  const mustUseTools = isNumericOrSpatialQuery(lastUserMsg) || mustFetchWeb;
  let requestedWebFetchCompleted = false;
  let toolChoiceSupported = true;
  const thinking = { type: thinkingEnabled ? 'enabled' : 'disabled' };
  const reasoning_effort = thinkingEnabled ? 'high' : undefined;
  const reasoningBudget = createReasoningTraceBudget();
  let intentTraceFinalized = false;
  let intentCalls = [];
  const questionTraceScope = extractExplicitTraceScope(lastUserMsg);
  const accumulatedTraceCalls = [];
  let publishedTraceScopeSignature = '';
  const deepSeekUserId = (sessionId && userId) ? `u${userId}-s${sessionId}` : (sessionId ? `s${sessionId}` : undefined);

  const publishTraceContext = () => {
    const toolTraceScope = extractToolTraceScope(accumulatedTraceCalls);
    const scope = mergeTraceScopes(questionTraceScope, toolTraceScope);
    if (!hasTraceScope(scope)) return;

    const signature = JSON.stringify(scope);
    if (signature === publishedTraceScopeSignature) return;
    publishedTraceScopeSignature = signature;
    const scopeText = formatTraceScope(scope);
    writeAgentTrace(res, {
      id: 'trace_context',
      phase: 'intent',
      status: 'completed',
      title: '建立时空分析语境',
      summary: `已将${scopeText}纳入本轮分析范围。`,
      parameters: Object.fromEntries(Object.entries(scope).filter(([key]) => key !== 'scope_source')),
      scope_source: scope.scope_source,
      source: scope.scope_source === 'tool' ? 'DeepSeek Tool Parameters' : 'User Query'
    });
  };

  // 仅在当前问题明确给出区域或时间时提前展示；否则等待真实工具参数。
  publishTraceContext();

  writeAgentTrace(res, {
    id: 'trace_intent',
    phase: 'intent',
    status: 'running',
    title: '意图理解与参数提取',
    summary: '正在识别分析目标、时空范围与用户关注的地类约束。',
    detail: `用户问题：${lastUserMsg}`,
    parameters: {
      model: apiModel,
      question: lastUserMsg
    },
    source: 'DeepSeek Agent'
  });

  for (let round = 0; round < maxToolRounds; round++) {
    const decisionTraceId = `trace_decision_${round}`;
    const decisionStartedAt = Date.now();
    const decisionRunningSummary = usedTools
      ? '模型正在分析已有工具结果，判断继续补充证据或生成回答。'
      : '模型正在理解任务约束，判断所需证据与工具。';
    writeAgentTrace(res, {
      id: decisionTraceId,
      phase: 'decision',
      status: 'running',
      title: `模型分析与决策 · 第 ${round + 1} 轮`,
      summary: decisionRunningSummary,
      round,
      source: 'DeepSeek'
    });
    writeWorkflow(res, {
      id: `deepseek_decision_${round}`,
      label: 'DeepSeek 官方接口 → 分析证据并形成下一步决策',
      type: 'analysis',
      iconKey: 'brain',
      done: false
    });

    // Use streaming for each step to robustly capture tool_calls (arguments may be chunked in streams).
    // IMPORTANT: DeepSeek tool-calling needs `tools` on every sub-request in the loop.
    //
    // Note: some DeepSeek models / modes may reject `tool_choice`. We keep tool forcing
    // primarily at the application layer (see "must use tools" fallback below).
    let stepStream;
    try {
      stepStream = await createDeepSeekChatCompletion({
        model: apiModel,
        messages,
        tools: agentTools,
        stream: true,
        options: {
          temperature: 0.1,
          top_p: 0.9,
          thinking,
          user_id: deepSeekUserId,
          ...(toolChoiceSupported ? { tool_choice: (mustUseTools && !usedTools) ? 'required' : 'auto' } : {}),
          ...(reasoning_effort ? { reasoning_effort } : {})
        }
      });
    } catch (err) {
      // Some DeepSeek modes may reject tool_choice; retry without it.
      const msg = (err?.message || String(err)).toLowerCase();
      if (msg.includes('tool_choice')) {
        toolChoiceSupported = false;
        stepStream = await createDeepSeekChatCompletion({
          model: apiModel,
          messages,
          tools: agentTools,
          stream: true,
          options: {
            temperature: 0.1,
            top_p: 0.9,
            thinking,
            user_id: deepSeekUserId,
            ...(reasoning_effort ? { reasoning_effort } : {})
          }
        });
      } else {
        throw err;
      }
    }

    let decisionReasoning = '';
    let lastDecisionTracePublish = 0;
    const assistantMessage = await consumeDeepSeekStreamToMessage(stepStream, {
      reasoningBudget,
      shouldAbort: () => res.writableEnded || res.destroyed,
      onReasoningDelta: (delta) => {
        decisionReasoning += delta;
        writeSSE(res, { thinking: delta });
        if (decisionReasoning.length - lastDecisionTracePublish >= 600 || delta === TRACE_REASONING_TRUNCATION_MARKER) {
          lastDecisionTracePublish = decisionReasoning.length;
          writeAgentTrace(res, {
            id: decisionTraceId,
            phase: 'decision',
            status: 'running',
            title: `模型分析与决策 · 第 ${round + 1} 轮`,
            summary: decisionRunningSummary,
            detail: summarizeReasoningForTrace(decisionReasoning),
            reasoning: decisionReasoning,
            round,
            duration_ms: Date.now() - decisionStartedAt,
            source: 'DeepSeek'
          });
        }
      }
    });

    // Some providers / edge cases may leak DeepSeek DSML tool-call blocks into `content`
    // instead of returning a structured `tool_calls` array. Recover tool calls from DSML if needed.
    const dsmlRecovered = (!assistantMessage.tool_calls?.length && assistantMessage.content)
      ? extractDsmlToolCalls(assistantMessage.content, round)
      : null;

    const recoveredToolCalls = dsmlRecovered?.tool_calls || [];
    let finalToolCalls = (assistantMessage.tool_calls && assistantMessage.tool_calls.length)
      ? assistantMessage.tool_calls
      : recoveredToolCalls;

    // 用户明确给出 URL 时，网页读取是确定性路由。若模型返回了其它工具或直接回答，
    // 仍补入该 URL 的 web_fetch 调用，避免误报“当前环境不具备访问外部网页的能力”。
    const hasRequestedWebFetchCall = finalToolCalls.some((call) => {
      if (call.function?.name !== 'web_fetch') return false;
      const callArgs = parseToolArguments(call.function?.arguments);
      return String(callArgs?.url || '').trim() === directWebFetchUrl;
    });
    if (mustFetchWeb && !requestedWebFetchCompleted && !hasRequestedWebFetchCall && toolByName.has('web_fetch')) {
      finalToolCalls = [
        ...finalToolCalls,
        {
          index: finalToolCalls.length,
          id: `forced_web_fetch_${round}`,
          type: 'function',
          function: {
            name: 'web_fetch',
            arguments: JSON.stringify({ url: directWebFetchUrl })
          }
        }
      ];
    }

    const safeAssistantContent = dsmlRecovered ? dsmlRecovered.content : assistantMessage.content;

    const plannedCalls = finalToolCalls.map((call) => ({
      tool: call.function?.name || 'unknown_tool',
      parameters: sanitizeTraceValue(parseToolArguments(call.function?.arguments))
    }));
    if (plannedCalls.length) {
      accumulatedTraceCalls.push(...plannedCalls);
      publishTraceContext();
    }
    const reasoningText = decisionReasoning;
    const reasoningSummaryText = assistantMessage.reasoning_content || decisionReasoning;
    const requiresToolRetry = !finalToolCalls.length && !usedTools && mustUseTools;
    const hasFinalAnswer = !finalToolCalls.length && Boolean(safeAssistantContent) && !requiresToolRetry;
    const decisionTitle = finalToolCalls.length
      ? `模型确定第 ${round + 1} 轮工具调用路径`
      : (requiresToolRetry
          ? `模型复核第 ${round + 1} 轮证据充分性`
          : (hasFinalAnswer ? '模型整合证据并生成回答' : `模型完成第 ${round + 1} 轮分析决策`));
    const decisionSummary = finalToolCalls.length
      ? `模型决定调用 ${finalToolCalls.length} 个工具补充证据。`
      : (requiresToolRetry
          ? '当前回答缺少必要的工具证据，系统将要求模型重新选择工具。'
          : (hasFinalAnswer
              ? (usedTools ? '模型已吸收工具结果并形成最终回答。' : '模型已根据当前上下文形成最终回答。')
              : '模型本轮未追加工具，也未返回可交付正文。'));
    writeAgentTrace(res, {
      id: decisionTraceId,
      phase: 'decision',
      status: 'completed',
      title: decisionTitle,
      summary: decisionSummary,
      detail: summarizeReasoningForTrace(reasoningSummaryText, plannedCalls.map((item) => item.tool)),
      reasoning: reasoningText,
      ...(plannedCalls.length ? { parameters: { calls: plannedCalls } } : {}),
      round,
      duration_ms: Date.now() - decisionStartedAt,
      source: 'DeepSeek'
    });
    writeWorkflow(res, {
      id: `deepseek_decision_${round}`,
      label: decisionTitle,
      type: 'analysis',
      iconKey: 'brain',
      done: true
    });

    if (finalToolCalls.length) intentCalls = plannedCalls;
    const shouldFinalizeIntent = finalToolCalls.length > 0
      || !mustUseTools
      || usedTools
      || round === maxToolRounds - 1;
    if (!intentTraceFinalized && shouldFinalizeIntent) {
      writeAgentTrace(res, {
        id: 'trace_intent',
        phase: 'intent',
        status: 'completed',
        title: '意图理解与参数提取',
        summary: intentCalls.length
          ? `已识别分析任务，并提取出 ${intentCalls.length} 组工具参数。`
          : '已识别分析任务，模型判断无需调用工具。',
        detail: summarizeReasoningForTrace(reasoningSummaryText, plannedCalls.map((item) => item.tool)),
        parameters: {
          calls: intentCalls
        },
        source: 'DeepSeek Agent'
      });
      intentTraceFinalized = true;
    }

    messages.push({
      role: 'assistant',
      content: safeAssistantContent || '',
      reasoning_content: assistantMessage.reasoning_content || undefined,
      ...(finalToolCalls.length ? { tool_calls: finalToolCalls } : {})
    });

    if (!finalToolCalls.length) {
      const finalText = safeAssistantContent || '';

      // If the model tries to answer without any tool usage, enforce one tool call for stability.
      // This prevents "memory answers" and ensures each session request is grounded in real queries.
      if (requiresToolRetry) {
        // First, retry once with a strong tool_choice hint.
        messages.push({
          role: 'system',
          content: '强制规范：本轮回答必须先至少调用一次业务工具获取或核验数据，再输出最终结论。请立刻发起工具调用，不要直接给出最终答案。'
        });
        continue;
      }

      if (finalText) {
        writeSSE(res, { content: finalText });
        return finalText.length;
      }
      break;
    }

    for (const [callIndex, toolCall] of finalToolCalls.entries()) {
      const toolName = toolCall.function?.name;
      const tool = toolByName.get(toolName);
      const args = parseToolArguments(toolCall.function?.arguments);
      const toolCallId = String(toolCall?.id || '').trim();
      const stableToolCallKey = toolCallId ? toolCallId : `${round}_${toolName}`;
      const traceToolId = `trace_tool_${round}_${callIndex}`;
      const toolStartedAt = Date.now();

      writeAgentTrace(res, {
        id: traceToolId,
        phase: 'tool_call',
        status: 'running',
        title: `执行工具 · ${toolName || '未知工具'}`,
        summary: toolName ? `正在按规划调用 ${toolName}。` : '模型返回了无法识别的工具调用。',
        tool: toolName || 'unknown_tool',
        parameters: args,
        round,
        source: tool?.metadata?.source === 'mcp' ? 'MCP Client' : 'Agent Tool'
      });

      if (!tool) {
        const missingToolError = `工具不存在: ${toolName || 'unknown_tool'}`;
        messages.push({
          role: 'tool',
          tool_call_id: toolCallId || stableToolCallKey,
          content: missingToolError
        });
        writeAgentTrace(res, {
          id: traceToolId,
          phase: 'tool_call',
          status: 'error',
          title: `执行工具 · ${toolName || '未知工具'}`,
          summary: `未找到工具 ${toolName || 'unknown_tool'}，无法执行。`,
          tool: toolName || 'unknown_tool',
          parameters: args,
          error: missingToolError,
          round,
          duration_ms: Date.now() - toolStartedAt,
          source: 'Agent Tool'
        });
        writeAgentTrace(res, {
          id: `trace_observation_${round}_${callIndex}`,
          phase: 'observation',
          status: 'error',
          title: `Observation · ${toolName || 'unknown_tool'} → 回灌模型`,
          summary: missingToolError,
          detail: '工具路由错误已作为下一轮上下文回传给 DeepSeek，以便模型重新规划。',
          tool: toolName || 'unknown_tool',
          observation: buildObservationTrace(missingToolError),
          error: missingToolError,
          round,
          source: 'Agent Observation'
        });
        continue;
      }

      const statusText = toolTitleMap[toolName] ? toolTitleMap[toolName](args) : `正在运行业务组件: ${toolName}...`;
      const toolSourceLabel = tool.metadata?.source === 'mcp' ? 'MCP Client → tools/call' : 'agentTools fallback';
      writeWorkflow(res, {
        id: `tool_${stableToolCallKey}`,
        label: `${toolSourceLabel} → 调用 ${toolFileMap[toolName] || toolName + 'Tool'} | ${statusText}`,
        type: 'search',
        iconKey: 'tool',
        done: false
      });

      let output;
      let cacheHit = false;
      try {
        // Avoid repeated identical tool calls within the same question (reduces latency + prevents loop storms).
        const cacheKey = `${toolName}::${JSON.stringify(args || {})}`;
        if (toolResultCache.has(cacheKey)) {
          cacheHit = true;
          output = toolResultCache.get(cacheKey);
        } else {
          output = await tool.call(args);
          toolResultCache.set(cacheKey, output);
        }
      } catch (err) {
        output = `工具调用失败: ${err.message || String(err)}`;
      }

      // 政策/文献索引中的 sources 只是引用入口。命中后自动读取来源完整正文，
      // 并把正文拼接到同一个工具 Observation 中，确保下一轮 DeepSeek 能直接使用原文上下文。
      if (toolName === 'policy_reference_lookup' && toolByName.has('web_fetch')) {
        const sourceUrls = extractSourceUrls(output);
        const sourceTexts = [];
        const sourceTool = toolByName.get('web_fetch');
        for (const [sourceIndex, sourceUrl] of sourceUrls.entries()) {
          const sourceArgs = { url: sourceUrl };
          const sourceCallId = `${stableToolCallKey}_source_${sourceIndex}`;
          const sourceStartedAt = Date.now();
          writeAgentTrace(res, {
            id: `trace_source_fetch_${round}_${callIndex}_${sourceIndex}`,
            phase: 'tool_call',
            status: 'running',
            title: '执行工具 · web_fetch',
            summary: `正在读取政策/文献来源正文：${sourceUrl}`,
            tool: 'web_fetch',
            parameters: sourceArgs,
            round,
            source: sourceTool.metadata?.source === 'mcp' ? 'MCP Client' : 'Agent Tool'
          });
          writeWorkflow(res, {
            id: `source_fetch_${sourceCallId}`,
            label: `${sourceTool.metadata?.source === 'mcp' ? 'MCP Client → tools/call' : 'agentTools fallback'} → 调用 webFetchTool | 正在读取来源正文`,
            type: 'search',
            iconKey: 'tool',
            done: false
          });

          let sourceOutput;
          try {
            const sourceCacheKey = `web_fetch::${JSON.stringify(sourceArgs)}`;
            if (toolResultCache.has(sourceCacheKey)) {
              sourceOutput = toolResultCache.get(sourceCacheKey);
            } else {
              sourceOutput = await sourceTool.call(sourceArgs);
              toolResultCache.set(sourceCacheKey, sourceOutput);
            }
          } catch (sourceError) {
            sourceOutput = `网页资料读取失败: ${sourceError.message || String(sourceError)}`;
          }

          const sourceFailure = getToolFailureMessage(sourceOutput);
          const sourceObservation = buildObservationTrace(sourceOutput);
          writeAgentTrace(res, {
            id: `trace_source_fetch_${round}_${callIndex}_${sourceIndex}`,
            phase: 'tool_call',
            status: sourceFailure ? 'error' : 'completed',
            title: '执行工具 · web_fetch',
            summary: sourceFailure
              ? '来源网页读取失败，失败信息将随政策检索结果回灌。'
              : '来源网页正文已读取，并将并入政策检索 Observation。',
            tool: 'web_fetch',
            parameters: sourceArgs,
            round,
            duration_ms: Date.now() - sourceStartedAt,
            ...(sourceFailure ? { error: sourceFailure } : {}),
            source: sourceTool.metadata?.source === 'mcp' ? 'MCP Client' : 'Agent Tool'
          });
          writeAgentTrace(res, {
            id: `trace_source_observation_${round}_${callIndex}_${sourceIndex}`,
            phase: 'observation',
            status: sourceFailure ? 'error' : 'completed',
            title: 'Observation · web_fetch → 回灌模型',
            summary: sourceFailure ? sourceFailure : sourceObservation.summary,
            detail: '网页纯文本已作为政策检索结果的补充上下文回传给 DeepSeek。',
            tool: 'web_fetch',
            observation: sourceObservation,
            round,
            ...(sourceFailure ? { error: sourceFailure } : {}),
            source: 'Agent Observation'
          });
          writeWorkflow(res, {
            id: `source_fetch_${sourceCallId}`,
            label: sourceFailure ? `webFetchTool → 读取失败: ${summarizeTraceText(sourceFailure, 80)}` : 'webFetchTool → 来源网页正文读取完成',
            type: 'analysis',
            iconKey: sourceFailure ? 'analysis' : 'check',
            done: true
          });
          sourceTexts.push(`### 来源正文：${sourceUrl}\n${serializeToolOutput(sourceOutput)}`);
        }

        if (sourceTexts.length > 0) {
          output = `${serializeToolOutput(output)}\n\n## 来源网页正文（自动读取）\n${sourceTexts.join('\n\n')}`;
        }
      }

      usedTools = true;
      if (
        toolName === 'web_fetch'
        && (!directWebFetchUrl || String(args?.url || '').trim() === directWebFetchUrl)
      ) {
        requestedWebFetchCompleted = true;
      }

      const toolFailure = getToolFailureMessage(output);
      const observation = buildObservationTrace(output);
      writeAgentTrace(res, {
        id: traceToolId,
        phase: 'tool_call',
        status: toolFailure ? 'error' : 'completed',
        title: `执行工具 · ${toolName}`,
        summary: toolFailure
          ? `工具 ${toolName} 执行失败，错误信息已回灌给模型。`
          : `工具 ${toolName} 执行完成${cacheHit ? '（命中本轮缓存）' : ''}，已获得可供模型使用的结果。`,
        tool: toolName,
        parameters: args,
        round,
        duration_ms: Date.now() - toolStartedAt,
        ...(toolFailure ? { error: toolFailure } : {}),
        source: tool?.metadata?.source === 'mcp' ? 'MCP Client' : 'Agent Tool'
      });
      writeAgentTrace(res, {
        id: `trace_observation_${round}_${callIndex}`,
        phase: 'observation',
        status: toolFailure ? 'error' : 'completed',
        title: `Observation · ${toolName} → 回灌模型`,
        summary: toolFailure ? `工具未返回有效 Observation：${toolFailure}` : observation.summary,
        detail: `${cacheHit ? '复用了本轮相同参数的工具结果。' : '工具完成了数据查询或计算。'}结果已作为下一轮上下文回传给 DeepSeek。${observation.truncated ? ' 展示内容已截断。' : ''}`,
        tool: toolName,
        observation,
        round,
        ...(toolFailure ? { error: toolFailure } : {}),
        source: 'Agent Observation'
      });

      writeWorkflow(res, {
        id: `tool_${stableToolCallKey}`,
        label: toolFailure
          ? `${toolFileMap[toolName] || toolName + 'Tool'} → 执行失败: ${summarizeTraceText(toolFailure, 80)}`
          : `${toolFileMap[toolName] || toolName + 'Tool'} → ${toolArchitectureEndMap[toolName] || '调度执行完成'}`,
        type: 'analysis',
        iconKey: toolFailure ? 'analysis' : 'check',
        done: true
      });

      messages.push({
        role: 'tool',
        tool_call_id: toolCallId || stableToolCallKey,
        content: serializeToolOutput(output)
      });
    }
  }

  writeWorkflow(res, {
    id: 'deepseek_final',
    label: 'DeepSeek 官方接口 → 基于工具结果生成最终答案',
    type: 'analysis',
    iconKey: 'analysis',
    done: false
  });

  const synthesisTraceId = 'trace_synthesis';
  const synthesisStartedAt = Date.now();
  let synthesisReasoning = '';
  let lastSynthesisTracePublish = 0;
  writeAgentTrace(res, {
    id: synthesisTraceId,
    phase: 'synthesis',
    status: 'running',
    title: '决策整合与结论生成',
    summary: '模型正在融合工具 Observation，组织证据链并生成最终回答。',
    source: 'DeepSeek'
  });

  const finalMessages = [...messages];
  let finalChunkCount = 0;
  let completeAnswer = '';
  let previousRawSegment = '';
  let segment = 0;

  while (!res.writableEnded && !res.destroyed) {
    const finalResponse = await createDeepSeekChatCompletion({
      model: apiModel,
      messages: finalMessages,
      stream: true,
      options: {
        temperature: 0.1,
        top_p: 0.9,
        thinking,
        user_id: deepSeekUserId,
        ...(reasoning_effort ? { reasoning_effort } : {})
      }
    });

    const segmentResult = await streamDeepSeekResponse(finalResponse, res, {
      reasoningBudget,
      emitContent: segment === 0,
      onReasoningDelta: (delta) => {
        synthesisReasoning += delta;
        if (synthesisReasoning.length - lastSynthesisTracePublish >= 600 || delta === TRACE_REASONING_TRUNCATION_MARKER) {
          lastSynthesisTracePublish = synthesisReasoning.length;
          writeAgentTrace(res, {
            id: synthesisTraceId,
            phase: 'synthesis',
            status: 'running',
            title: '决策整合与结论生成',
            summary: '模型正在吸收 Observation，并逐步组织证据链与结论。',
            detail: summarizeReasoningForTrace(synthesisReasoning),
            reasoning: synthesisReasoning,
            duration_ms: Date.now() - synthesisStartedAt,
            source: 'DeepSeek'
          });
        }
      }
    });
    if (res.writableEnded || res.destroyed) break;

    const rawSegment = String(segmentResult.content || '');
    const uniqueSegment = segment === 0
      ? rawSegment
      : removeContinuationOverlap(completeAnswer, rawSegment);

    if (segment > 0 && uniqueSegment) {
      writeSSE(res, { content: uniqueSegment });
    }
    if (uniqueSegment) {
      completeAnswer += uniqueSegment;
      finalChunkCount += segmentResult.chunkCount;
    }

    const reachedOutputLimit = ['length', 'max_tokens'].includes(String(segmentResult.finishReason || '').toLowerCase());
    if (!reachedOutputLimit || !rawSegment || !uniqueSegment || rawSegment === previousRawSegment) break;

    previousRawSegment = rawSegment;
    finalMessages.push(
      {
        role: 'assistant',
        content: uniqueSegment,
        ...(segmentResult.reasoningContent ? { reasoning_content: segmentResult.reasoningContent } : {})
      },
      {
        role: 'user',
        content: '上一段回答因接口单次输出上限而中断。请直接从中断处继续，保持原有 Markdown 层级，不要重复已经输出的内容，也不要添加续写说明。'
      }
    );
    segment += 1;
  }
  writeAgentTrace(res, {
    id: synthesisTraceId,
    phase: 'synthesis',
    status: 'completed',
    title: '决策整合与结论生成',
    summary: '模型已完成证据整合并输出最终结论。',
    reasoning: synthesisReasoning,
    duration_ms: Date.now() - synthesisStartedAt,
    source: 'DeepSeek'
  });
  writeWorkflow(res, {
    id: 'deepseek_final',
    label: 'DeepSeek 官方接口 → 完成证据整合与回答生成',
    type: 'analysis',
    iconKey: 'check',
    done: true
  });
  return finalChunkCount;
}

function formatAIError(err) {
  const msg = err?.message || String(err);
  if (err?.code === 'EMPTY_STREAM_RESPONSE') return '模型未返回有效内容，请稍后重试。';
  if (err?.code === 'DEEPSEEK_REQUEST_TIMEOUT') return 'DeepSeek 官方接口请求超时，请检查显式配置的 DEEPSEEK_REQUEST_TIMEOUT_MS 或稍后重试。';
  if (err?.code === 'DEEPSEEK_API_KEY_MISSING') return 'DeepSeek 官方接口未配置 API Key，请在环境变量 DEEPSEEK_API_KEY 中填写密钥。';
  if (err?.status === 401 || err?.status === 403) return 'DeepSeek 官方接口鉴权失败，请检查 DEEPSEEK_API_KEY。';
  if (err?.status === 524 || msg.includes('524')) return 'DeepSeek 官方接口上游超时（524），通常是服务繁忙或排队导致，请稍后重试。';
  if (msg.includes('503')) return '模型繁忙（加载中），请稍后重试。';
  if (msg.toLowerCase().includes('eof')) return '模型上游连接中断（EOF），请稍后重试。';
  if (msg.toLowerCase().includes('fetch failed')) return '模型上游网络波动（fetch failed），请稍后重试。';
  return `AI 异常: ${msg.slice(0, 120)}`;
}

async function handleAIStream(req, res) {
  const { year, messages, question, model, think, deepThinking, region, sessionId } = req.body;
  const isThinkingEnabled = (deepThinking ?? think) !== false;
  const selectedModel = model || getDefaultModel();
  const fallbackEnabled = getEnableFallback();

  let history = [];
  if (sessionId && req.user?.id) {
    try {
      history = await loadSessionHistory(sessionId, req.user.id);
      if (!history.length) {
        return res.status(403).json({ error: '会话不存在或无权访问', code: 'SESSION_NOT_FOUND' });
      }
    } catch {
      return res.status(403).json({ error: '会话不存在或无权访问', code: 'SESSION_NOT_FOUND' });
    }
  }

  if (!sessionId && !history.length) {
    history = Array.isArray(messages)
      ? sanitizeHistoryMessages(messages)
      : (question ? [{ role: 'user', content: String(question) }] : []);
  }

  if (history.length === 0) {
    return res.status(400).json({ error: '请提供问题内容（messages 或 question）' });
  }

  // Do not truncate or reject a session based on an application-side character
  // budget. DeepSeek is responsible for enforcing the actual context boundary.
  history = preserveSessionHistory(history);

  const lastUserMsg = history.filter((m) => m?.role === 'user').pop()?.content || '';
  const validation = aiMiddleware.validateInput(lastUserMsg);
  if (!validation.safe) {
    return res.status(403).json({ error: validation.reason });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let keepAlive = null;
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    if (keepAlive) {
      clearInterval(keepAlive);
      keepAlive = null;
    }
    if (!res.writableEnded && !res.destroyed) {
      res.end();
    }
  };

  try {
    if (validation.offTopic) {
      writeSSE(res, {
        content: '当前 GeoAI Agent 主要处理土地利用、空间分析、生态监测以及政策与规划资料解释。请补充与地理空间研究相关的问题或数据需求。'
      });
      writeSSE(res, { done: true });
      return;
    }

    keepAlive = setInterval(() => {
      if (!res.writableEnded && !res.destroyed) {
        res.write(': keep-alive\n\n');
      }
    }, 3000);

    writeAgentTrace(res, {
      id: 'trace_ingress',
      phase: 'system',
      status: 'completed',
      title: '接收空间分析请求',
      summary: '请求已通过鉴权与输入边界检查，SSE 双向事件流已建立。',
      source: 'POST /api/ai/analyze-stream'
    });

    await writeWorkflowSequence(res, [
      {
        id: 'app_submit',
        label: `App用户端 → 提交空间分析问题: ${lastUserMsg.slice(0, 36)}${lastUserMsg.length > 36 ? '...' : ''}`,
        type: 'analysis',
        iconKey: 'brain'
      },
      {
        id: 'post_sse',
        label: 'POST接口 → 建立SSE流式响应',
        type: 'search',
        iconKey: 'search'
      }
    ], 110);

    const llmHost = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    const retryMax = getRetryCount();
    const retryDelayMs = getRetryDelayMs();
    const modelCandidates = fallbackEnabled
      ? getFallbackModelCandidates(selectedModel)
      : [selectedModel];

    const toolTitleMap = {
      'clcd_analysis': (args) => `正在通过 PostgreSQL/PostGIS 提取 ${args.region || '目标区域'} 土地利用遥感数据(CLCD)...`,
      'dashboard_analysis': (args) => `正在通过 PostgreSQL/PostGIS 查询 ${args.region || '目标区域'} 综合指标...`,
      'spatial_stats_analysis': (args) => `正在通过 PostgreSQL/PostGIS 执行 ${args.region || '目标区域'} 空间重心转移与椭圆轨迹计算...`,
      'land_transfer_analysis': (args) => `正在通过 PostgreSQL/PostGIS 分析 ${args.region || '目标区域'} 土地利用转移矩阵(LUCC)...`,
      'weather_query': (args) => `正在通过 PostgreSQL/PostGIS 获取 ${args.city || '目标城市'} 实时气象观测...`,
      'knowledge_query': (args) => `通过 MCP (server/mcp/index.js) 检索 知识图谱 (knowledge_graph.json) | 模式: ${args.mode || 'metadata'}...`,
      'knowledge_base_lookup': (args) => `正在检索 skills知识库: ${args.skill_name || '专业技能文档'}...`,
      'knowledge_graph_query': (args) => `通过 MCP (server/mcp/index.js) 检索 知识图谱 (knowledge_graph.json) | 模式: ${args.mode || 'metadata'}...`,
      'policy_reference_lookup': (args) => `正在检索本地政策与规划索引: ${args.region || '目标区域'} 相关资料...`,
      'web_fetch': (args) => `正在读取政策/文献来源网页: ${args.url || '已登记来源'}...`
    };

    const toolArchitectureEndMap = {
      'clcd_analysis': 'PostgreSQL/PostGIS 业务数据查询完成',
      'dashboard_analysis': 'PostgreSQL/PostGIS 统计指标准备完毕',
      'spatial_stats_analysis': 'PostgreSQL/PostGIS 空间统计计算完成',
      'land_transfer_analysis': 'PostgreSQL/PostGIS 转移矩阵分析完成',
      'weather_query': 'PostgreSQL/PostGIS 实时气象数据查询完成',
      'knowledge_query': 'MCP 知识图谱节点关系解析完成',
      'knowledge_graph_query': 'MCP 知识图谱节点关系解析完成',
      'knowledge_base_lookup': 'skills知识库 专家语义检索完成',
      'policy_reference_lookup': '本地政策文献索引检索完成',
      'web_fetch': '来源网页正文读取完成'
    };

    // Preserve DeepSeek thinking-mode context: carry over assistant reasoning_content when present.
    // (This improves stability for multi-round tool loops and reduces EMPTY_STREAM_RESPONSE cases.)
    const chatHistoryBase = history
      .slice(0, -1)
      .map((h) => ({
        role: h.role,
        content: h.content,
        ...(h.role === 'assistant' && h.reasoning_content ? { reasoning_content: h.reasoning_content } : {})
      }));
    let lastError = null;

    for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex++) {
      const currentModel = modelCandidates[modelIndex];
      const currentSystemPrompt = aiMiddleware.buildSystemPrompt({
        model: currentModel,
        thinking: isThinkingEnabled,
        region,
        year
      });
      const useDeepSeekOfficial = isDeepSeekOfficialModel(currentModel);
      const llmProviderLabel = useDeepSeekOfficial ? 'DeepSeek 官方接口' : 'Ollama LLM';

      writeWorkflow(res, {
        id: `llm_model_${modelIndex}`,
        label: `${llmProviderLabel} → 装载模型 ${currentModel}`,
        type: 'analysis',
        iconKey: 'analysis'
      });
      writeAgentTrace(res, {
        id: `trace_model_${modelIndex}`,
        phase: 'system',
        status: 'completed',
        title: '装载推理模型',
        summary: `已选择 ${currentModel}，准备进入 GeoAI Agent 工具调度循环。`,
        parameters: {
          model: currentModel,
          provider: useDeepSeekOfficial ? 'deepseek_official' : 'ollama_local',
          thinking_enabled: isThinkingEnabled
        },
        source: llmProviderLabel
      });
      // Server-side audit log (helps diagnose model/provider mismatches without relying on the UI)
      try {
        logger.info('[AI][ModelRoute]', {
          sessionId: sessionId || null,
          selectedModel,
          currentModel,
          provider: useDeepSeekOfficial ? 'deepseek_official' : 'ollama_local',
          thinkingEnabled: isThinkingEnabled,
          region: region || null,
          year: year || null
        });
      } catch {
        // ignore
      }

      if (fallbackEnabled && modelIndex > 0) {
        writeWorkflow(res, {
          id: `llm_fallback_${modelIndex}`,
          label: `${llmProviderLabel} → 切换备用模型 ${currentModel}`,
          type: 'analysis',
          iconKey: 'analysis'
        });
      }

      for (let attempt = 0; attempt <= retryMax; attempt++) {
        const routerWorkflowId = `${useDeepSeekOfficial ? 'deepseek' : 'ollama'}_router_${modelIndex}_${attempt}`;
        const retryWorkflowId = attempt > 0 ? `retry_${modelIndex}_${attempt}` : '';
        try {
          if (attempt > 0) {
            writeWorkflow(res, {
              id: retryWorkflowId,
              label: `POST接口 → 重试模型调用链路（第 ${attempt + 1} 次）`,
              type: 'search',
              iconKey: 'search',
              done: false
            });
          }

          if (useDeepSeekOfficial) {
            writeWorkflow(res, {
              id: routerWorkflowId,
              label: 'DeepSeek Agent → 准备进入分析决策循环',
              type: 'analysis',
              iconKey: 'tool',
              done: false
            });

            const localChunkCount = await runDeepSeekOfficialToolLoop({
              res,
              model: currentModel,
              systemPrompt: currentSystemPrompt,
              chatHistoryBase,
              lastUserMsg,
              toolTitleMap,
              toolArchitectureEndMap,
              thinkingEnabled: isThinkingEnabled,
              sessionId: sessionId || null,
              userId: req.user?.id || null
            });

            if (localChunkCount === 0) {
              throw createEmptyStreamError(currentModel);
            }
            writeWorkflow(res, {
              id: routerWorkflowId,
              label: 'DeepSeek Agent → 完成本轮分析决策与工具调度',
              type: 'analysis',
              iconKey: 'check',
              done: true
            });

            writeWorkflow(res, {
              id: 'result_deepseek',
              label: 'Result Aggregator → 汇总发现与证据链',
              type: 'analysis',
              iconKey: 'check'
            });
            writeWorkflow(res, {
              id: 'sse_done_deepseek',
              label: 'SSE流 → 回传答案与工作流状态',
              type: 'analysis',
              iconKey: 'check'
            });
            writeAgentTrace(res, {
              id: 'trace_delivery',
              phase: 'system',
              status: 'completed',
              title: '完成响应与证据链交付',
              summary: '最终回答和结构化 Agent Trace 已通过 SSE 发送，并将随当前 session 持久化。',
              source: 'SSE Result Aggregator'
            });
            writeSSE(res, { done: true });
            return;
          }

          writeWorkflow(res, {
            id: routerWorkflowId,
            label: 'Ollama Structured Router → 准备调度Agent工具链',
            type: 'analysis',
            iconKey: 'tool',
            done: false
          });

          const localChunkCount = await runOllamaStructuredToolLoop({
            res,
            model: currentModel,
            systemPrompt: currentSystemPrompt,
            chatHistoryBase,
            lastUserMsg,
            toolTitleMap,
            toolArchitectureEndMap,
            llmHost,
            thinkingEnabled: isThinkingEnabled
          });

          if (localChunkCount === 0) {
            throw createEmptyStreamError(currentModel);
          }
          writeWorkflow(res, {
            id: routerWorkflowId,
            label: '本地模型 → 完成本轮分析决策与工具调度',
            type: 'analysis',
            iconKey: 'check',
            done: true
          });

          writeWorkflow(res, {
            id: 'result_ollama',
            label: 'Result Aggregator → 汇总发现与证据链',
            type: 'analysis',
            iconKey: 'check'
          });
          writeWorkflow(res, {
            id: 'sse_done_ollama',
            label: 'SSE流 → 回传答案与工作流状态',
            type: 'analysis',
            iconKey: 'check'
          });
          writeSSE(res, { done: true });
          return;
        } catch (err) {
          lastError = err;
          const retryable = isRetryableError(err);
          const hasNextTry = retryable && attempt < retryMax;
          writeWorkflow(res, {
            id: routerWorkflowId,
            label: hasNextTry
              ? `${llmProviderLabel} → 本次调用未完成，准备重试`
              : `${llmProviderLabel} → 本次调用失败`,
            type: 'analysis',
            iconKey: 'analysis',
            done: true
          });
          if (retryWorkflowId) {
            writeWorkflow(res, {
              id: retryWorkflowId,
              label: hasNextTry ? '模型调用重试未完成，继续下一次尝试' : '模型调用重试结束',
              type: 'analysis',
              iconKey: hasNextTry ? 'search' : 'analysis',
              done: true
            });
          }
          if (hasNextTry) {
            // If upstream provides Retry-After (seconds or ms), respect it to reduce immediate 524 storms.
            const retryAfterRaw = Number(err?.retryAfter);
            const retryAfterMs = Number.isFinite(retryAfterRaw)
              ? (retryAfterRaw > 1000 ? Math.floor(retryAfterRaw) : Math.floor(retryAfterRaw * 1000))
              : 0;
            const baseDelayMs = retryDelayMs * Math.pow(2, attempt);
            const cappedRetryAfterMs = retryAfterMs > 0 ? Math.min(retryAfterMs, 300000) : 0;
            await sleep(cappedRetryAfterMs ? Math.max(baseDelayMs, cappedRetryAfterMs) : baseDelayMs);
            continue;
          }
          break;
        }
      }
    }

    throw lastError || new Error('AI 对话失败：未知错误');
  } catch (err) {
    logger.error('[AI][Agent Error]', { message: err?.message || String(err), stack: err?.stack });
    if (!res.writableEnded && !res.destroyed) {
      writeWorkflow(res, {
        id: 'workflow_error',
        label: `Workflow Trace → 执行失败: ${formatAIError(err)}`,
        type: 'analysis',
        iconKey: 'analysis'
      });
      writeAgentTrace(res, {
        id: 'trace_error',
        phase: 'system',
        status: 'error',
        title: 'Agent 执行异常',
        summary: formatAIError(err),
        error: err?.message || String(err),
        source: 'GeoAI Agent'
      });
      writeSSE(res, { error: formatAIError(err) });
      writeSSE(res, { done: true });
    }
  } finally {
    finish();
  }
}

router.post('/analyze-stream', [
  body('year').optional().isInt({ min: 1985, max: 2100 }),
  body('messages').optional().isArray().withMessage('Messages 必须是数组'),
  body('question').optional().isString().withMessage('Question 必须是字符串')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  handleAIStream(req, res);
});

router.post('/refresh-schema', (_req, res) => res.json({ success: true }));

export default router;
