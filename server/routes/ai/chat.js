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
import { agentTools } from '../../utils/agentTools.js';
import aiMiddleware from '../../utils/aiMiddleware.js';
import pool from '../../config/db.js';
import { createDeepSeekChatCompletion, isDeepSeekOfficialModel, resolveDeepSeekModel } from '../../utils/deepseekClient.js';
import logger from '../../config/logger.js';

const router = express.Router();

const getDefaultModel = () => process.env.CHAT_MODEL || process.env.OLLAMA_MODEL || 'deepseek-v4-flash';
const getFallbackModelCandidates = (primaryModel) => {
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
const getHistoryMessageLimit = () => {
  const value = Number(process.env.AI_CHAT_HISTORY_MAX_MESSAGES ?? 24);
  return Number.isFinite(value) ? Math.max(4, Math.floor(value)) : 24;
};
const getHistoryCharLimit = () => {
  const value = Number(process.env.AI_CHAT_HISTORY_MAX_CHARS ?? 24000);
  return Number.isFinite(value) ? Math.max(2000, Math.floor(value)) : 24000;
};
const getHistoryHardCharLimit = () => {
  const value = Number(process.env.AI_CHAT_HISTORY_HARD_MAX_CHARS ?? 42000);
  return Number.isFinite(value) ? Math.max(4000, Math.floor(value)) : 42000;
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
const stripInternalTags = (text) => {
  if (!text) return '';
  let content = String(text)
    .replace(/[｜]/g, '|')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[＜]/g, '<')
    .replace(/[＞]/g, '>')
    // map_control 已下线，但历史数据中仍可能存在该标记：继续清理以避免污染上下文
    .replace(/\[\[MAP_COMMAND:.*?\]\]/g, '')
    .replace(/^\[(?:SEARCH|ANALYSIS)\].*$/gim, '')
    .trim();

  // Some model families may leak tool-call protocol markers into plain text.
  // These are never meant for end users; keep them out of the conversation memory.
  const dsmlIndex = content.search(/<\|+\s*DSML/i);
  if (dsmlIndex >= 0) content = content.slice(0, dsmlIndex).trim();
  return content;
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

async function streamDeepSeekResponse(response, res) {
  const reader = response.body?.getReader();
  if (!reader) return 0;

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let chunkCount = 0;
  // Maintain a small rolling window so we can detect DSML markers across chunk boundaries.
  let pendingContent = '';
  let dsmlSuppressed = false;

  while (true) {
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

      // DeepSeek thinking mode streams `reasoning_content` separately from `content`.
      // Do NOT merge them into the same field; the front-end treats `thinking` differently.
      if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
        writeSSE(res, { thinking: delta.reasoning_content });
      }
      if (typeof delta.content === 'string' && delta.content) {
        if (!dsmlSuppressed) {
          pendingContent += delta.content;
          const normalized = normalizeSmartPunctuation(pendingContent);
          const dsmlIndex = normalized.search(/<\|+\s*DSML/i);
          if (dsmlIndex >= 0) {
            // Flush safe prefix before DSML, then suppress the rest.
            const safePrefix = pendingContent.slice(0, dsmlIndex);
            const safeOut = stripInternalTags(safePrefix);
            if (safeOut) {
              chunkCount++;
              writeSSE(res, { content: safeOut });
            }
            pendingContent = '';
            dsmlSuppressed = true;
            continue;
          }

          // To avoid holding large buffers, flush periodically while keeping a tail for detection.
          if (pendingContent.length >= 256) {
            const keepTail = 64;
            const flushText = pendingContent.slice(0, pendingContent.length - keepTail);
            const safeOut = stripInternalTags(flushText);
            if (safeOut) {
              chunkCount++;
              writeSSE(res, { content: safeOut });
            }
            pendingContent = pendingContent.slice(-keepTail);
          }
        } else {
          // DSML has started; suppress further `content` to avoid protocol leakage to the client.
          // no-op: keep reading to finish stream
        }
      }
    }
  }

  // Flush remaining pending content if DSML never started.
  if (!dsmlSuppressed && pendingContent) {
    const safeOut = stripInternalTags(pendingContent);
    if (safeOut) {
      chunkCount++;
      writeSSE(res, { content: safeOut });
    }
  }

  return chunkCount;
}

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

async function consumeDeepSeekStreamToMessage(response) {
  const reader = response.body?.getReader();
  if (!reader) return { content: '', reasoning_content: '', tool_calls: [] };

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  let content = '';
  let reasoningContent = '';

  // DeepSeek/OpenAI-style tool_calls streaming: function.arguments may be chunked.
  // We'll aggregate by (index, id) where possible, fallback to index.
  const toolCallMap = new Map();

  while (true) {
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
      if (delta.reasoning_content) reasoningContent += delta.reasoning_content;

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
    tool_calls: tool_calls.filter((tc) => tc.function?.name)
  };
}

async function runOllamaStructuredToolLoop({
  res,
  model,
  systemPrompt,
  chatHistoryBase,
  lastUserMsg,
  toolTitleMap,
  llmHost,
  thinkingEnabled = true
}) {
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

    if (kind === 'final') {
      const answer = String(decision?.answer || '').trim();
      if (!answer) break;

      // Enforce: every user turn must be grounded by at least one real tool call.
      // If the model tries to return a final answer before any tool usage, force a re-plan.
      if (!usedTools && mustUseTools) {
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
    writeWorkflow(res, {
      id: `tool_start_${round}_${toolName}`,
      label: `AgentTools → 调用 FunctionTool: ${toolName} | ${statusText}`,
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
      id: `tool_end_${round}_${toolName}`,
      label: `FunctionTool: ${toolName} → ${toolName.includes('analysis') ? '分析链条处理完成' : '地理数据查询完成'}`,
      type: 'analysis',
      iconKey: 'check'
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

  return streamOllamaResponseToSSE(finalResponse, res);
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
const trimHistoryWindow = (messages, maxMessages, maxChars) => {
  if (!messages.length) return [];
  const bounded = messages.slice(-maxMessages);
  const picked = [];
  let totalChars = 0;
  for (let i = bounded.length - 1; i >= 0; i--) {
    const item = bounded[i];
    const len = (item?.content?.length || 0) + (item?.reasoning_content?.length || 0);
    if (picked.length > 0 && totalChars + len > maxChars) break;
    picked.push(item);
    totalChars += len;
  }
  return picked.reverse();
};
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
  if (res.writableEnded) return;
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
  thinkingEnabled = false,
  sessionId = null,
  userId = null
}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistoryBase,
    { role: 'user', content: lastUserMsg }
  ];
  const toolByName = new Map(agentTools.map((tool) => [tool.metadata.name, tool]));
  const toolResultCache = new Map(); // key -> serialized tool output (per request loop)
  const apiModel = resolveDeepSeekModel(model);
  const maxToolRounds = 8;
  let usedTools = false;
  const mustUseTools = isNumericOrSpatialQuery(lastUserMsg);
  let toolChoiceSupported = true;
  const thinking = { type: thinkingEnabled ? 'enabled' : 'disabled' };
  const reasoning_effort = thinkingEnabled ? 'high' : undefined;
  // Allow longer answers by default (especially for province-wide or multi-year analysis).
  // Users explicitly asked to relax length limits so responses don't get truncated mid-way.
  const stepMaxTokens = Number(process.env.DEEPSEEK_STEP_MAX_TOKENS ?? process.env.DEEPSEEK_PLANNING_MAX_TOKENS ?? 4096);
  const deepSeekUserId = (sessionId && userId) ? `u${userId}-s${sessionId}` : (sessionId ? `s${sessionId}` : undefined);

  for (let round = 0; round < maxToolRounds; round++) {
    writeWorkflow(res, {
      id: `deepseek_tool_plan_${round}`,
      label: 'DeepSeek 官方接口 → 解析意图并规划分析路径',
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
          max_tokens: stepMaxTokens,
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
            max_tokens: stepMaxTokens,
            thinking,
            user_id: deepSeekUserId,
            ...(reasoning_effort ? { reasoning_effort } : {})
          }
        });
      } else {
        throw err;
      }
    }

    const assistantMessage = await consumeDeepSeekStreamToMessage(stepStream);

    // Some providers / edge cases may leak DeepSeek DSML tool-call blocks into `content`
    // instead of returning a structured `tool_calls` array. Recover tool calls from DSML if needed.
    const dsmlRecovered = (!assistantMessage.tool_calls?.length && assistantMessage.content)
      ? extractDsmlToolCalls(assistantMessage.content, round)
      : null;

    const recoveredToolCalls = dsmlRecovered?.tool_calls || [];
    const finalToolCalls = (assistantMessage.tool_calls && assistantMessage.tool_calls.length)
      ? assistantMessage.tool_calls
      : recoveredToolCalls;

    const safeAssistantContent = dsmlRecovered ? dsmlRecovered.content : assistantMessage.content;

    messages.push({
      role: 'assistant',
      content: safeAssistantContent || '',
      reasoning_content: assistantMessage.reasoning_content || undefined,
      ...(finalToolCalls.length ? { tool_calls: finalToolCalls } : {})
    });

    if (!finalToolCalls.length) {
      const reasoningText = assistantMessage.reasoning_content || '';
      const finalText = safeAssistantContent || '';
      if (reasoningText) writeSSE(res, { thinking: reasoningText });

      // If the model tries to answer without any tool usage, enforce one tool call for stability.
      // This prevents "memory answers" and ensures each session request is grounded in real queries.
      if (!usedTools && mustUseTools) {
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

    for (const toolCall of finalToolCalls) {
      const toolName = toolCall.function?.name;
      const tool = toolByName.get(toolName);
      const args = parseToolArguments(toolCall.function?.arguments);
      const toolCallId = String(toolCall?.id || '').trim();
      const stableToolCallKey = toolCallId ? toolCallId : `${round}_${toolName}`;

      if (!tool) {
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `工具不存在: ${toolName}`
        });
        continue;
      }

      const statusText = toolTitleMap[toolName] ? toolTitleMap[toolName](args) : `正在运行业务组件: ${toolName}...`;
      writeWorkflow(res, {
        id: `tool_start_${stableToolCallKey}`,
        label: `AgentTools → 调用 FunctionTool: ${toolName} | ${statusText}`,
        type: 'search',
        iconKey: 'tool',
        done: false
      });

      let output;
      try {
        // Avoid repeated identical tool calls within the same question (reduces latency + prevents loop storms).
        const cacheKey = `${toolName}::${JSON.stringify(args || {})}`;
        if (toolResultCache.has(cacheKey)) {
          output = toolResultCache.get(cacheKey);
        } else {
          output = await tool.call(args);
          toolResultCache.set(cacheKey, output);
        }
      } catch (err) {
        output = `工具调用失败: ${err.message || String(err)}`;
      }

      usedTools = true;

      writeWorkflow(res, {
        id: `tool_end_${stableToolCallKey}`,
        label: `FunctionTool: ${toolName} → ${toolName.includes('analysis') ? '分析链条处理完成' : '地理数据查询完成'}`,
        type: 'analysis',
        iconKey: 'check'
      });

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
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

  const finalMaxTokens = Number(process.env.DEEPSEEK_MAX_TOKENS ?? 8192);
  const finalResponse = await createDeepSeekChatCompletion({
    model: apiModel,
    messages,
    stream: true,
    options: {
      temperature: 0.1,
      top_p: 0.9,
      max_tokens: finalMaxTokens,
      thinking,
      user_id: deepSeekUserId,
      ...(reasoning_effort ? { reasoning_effort } : {})
    }
  });

  return streamDeepSeekResponse(finalResponse, res);
}

function formatAIError(err) {
  const msg = err?.message || String(err);
  if (err?.code === 'SESSION_CONTEXT_TOO_LARGE') return '当前会话上下文过长，请新建对话后继续。';
  if (err?.code === 'EMPTY_STREAM_RESPONSE') return '模型未返回有效内容，请稍后重试。';
  if (err?.code === 'DEEPSEEK_REQUEST_TIMEOUT') return 'DeepSeek 官方接口请求超时（上游繁忙/排队），请稍后重试或切换到本地模型。';
  if (err?.code === 'DEEPSEEK_API_KEY_MISSING') return 'DeepSeek 官方接口未配置 API Key，请在环境变量 DEEPSEEK_API_KEY 中填写密钥。';
  if (err?.status === 401 || err?.status === 403) return 'DeepSeek 官方接口鉴权失败，请检查 DEEPSEEK_API_KEY。';
  if (err?.status === 524 || msg.includes('524')) return 'DeepSeek 官方接口上游超时（524），通常是服务繁忙或排队导致。建议稍后重试，或启用本地 Ollama 备用模型。';
  if (msg.includes('503')) return '模型繁忙（加载中），请稍后重试。';
  if (msg.toLowerCase().includes('eof')) return '模型上游连接中断（EOF），请稍后重试。';
  if (msg.toLowerCase().includes('fetch failed')) return '模型上游网络波动（fetch failed），请稍后重试。';
  return `AI 异常: ${msg.slice(0, 120)}`;
}

async function handleAIStream(req, res) {
  const { year, messages, question, model, think, deepThinking, region, sessionId } = req.body;
  const isThinkingEnabled = (deepThinking ?? think) !== false;
  const selectedModel = model || getDefaultModel();
  const historyLimit = getHistoryMessageLimit();
  const historyCharLimit = getHistoryCharLimit();
  const historyHardCharLimit = getHistoryHardCharLimit();
  const fallbackEnabled = getEnableFallback();

  let history = [];
  let rawHistoryChars = 0;
  if (sessionId && req.user?.id) {
    try {
      history = await loadSessionHistory(sessionId, req.user.id);
      rawHistoryChars = history.reduce((sum, item) => sum + (item?.content?.length || 0), 0);
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
    rawHistoryChars = history.reduce((sum, item) => sum + (item?.content?.length || 0), 0);
  }

  if (history.length === 0) {
    return res.status(400).json({ error: '请提供问题内容（messages 或 question）' });
  }

  if (rawHistoryChars > historyHardCharLimit) {
    return res.status(413).json({
      error: '当前会话上下文过长，建议新建对话后继续提问。',
      code: 'SESSION_CONTEXT_TOO_LARGE',
      totalChars: rawHistoryChars
    });
  }

  history = trimHistoryWindow(history, historyLimit, historyCharLimit);

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
    if (!res.writableEnded) {
      res.end();
    }
  };

  try {
    if (validation.offTopic) {
      writeSSE(res, {
        content: '抱歉，我专注于云南土地利用变化分析，仅回答相关问题。'
      });
      writeSSE(res, { done: true });
      return;
    }

    keepAlive = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': keep-alive\n\n');
      }
    }, 3000);

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
      },
      {
        id: 'middleware_context',
        label: 'AI Middleware → 挂载地理空间上下文',
        type: 'search',
        iconKey: 'map'
      }
    ], 110);

    const llmHost = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    const retryMax = getRetryCount();
    const retryDelayMs = getRetryDelayMs();
    const modelCandidates = fallbackEnabled
      ? getFallbackModelCandidates(selectedModel)
      : [selectedModel];

    const toolTitleMap = {
      'clcd_analysis': (args) => `正在提取 ${args.region || '目标区域'} 土地利用遥感监测数据 (CLCD)...`,
      'dashboard_analysis': (args) => `正在汇总 ${args.region || '目标区域'} 综合指标仪表盘数据...`,
      'spatial_stats_analysis': (args) => `正在执行 ${args.region || '目标区域'} 空间重心转移与椭圆轨迹分析...`,
      'land_transfer_analysis': (args) => `正在分析 ${args.region || '目标区域'} 土地利用转移矩阵(LUCC)...`,
      'weather_query': (args) => `正在获取 ${args.city || '目标城市'} 实时气象观测数据...`,
      'knowledge_base_lookup': (args) => `正在检索专家知识库: ${args.skill_name || '专业技能'}...`,
      // map_control 已下线
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
        try {
          if (attempt > 0) {
            writeWorkflow(res, {
              id: `retry_${modelIndex}_${attempt}`,
              label: `POST接口 → 重试模型调用链路（第 ${attempt + 1} 次）`,
              type: 'search',
              iconKey: 'search',
              done: false
            });
          }

          if (useDeepSeekOfficial) {
            writeWorkflow(res, {
              id: `deepseek_router_${modelIndex}_${attempt}`,
              label: 'DeepSeek Tool Router → 准备调度Agent工具链',
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
              thinkingEnabled: isThinkingEnabled,
              sessionId: sessionId || null,
              userId: req.user?.id || null
            });

            if (localChunkCount === 0) {
              throw createEmptyStreamError(currentModel);
            }

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
            writeSSE(res, { done: true });
            return;
          }

          writeWorkflow(res, {
            id: `ollama_router_${modelIndex}_${attempt}`,
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
            llmHost,
            thinkingEnabled: isThinkingEnabled
          });

          if (localChunkCount === 0) {
            throw createEmptyStreamError(currentModel);
          }

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
    if (!res.writableEnded) {
      writeWorkflow(res, {
        id: 'workflow_error',
        label: `Workflow Trace → 执行失败: ${formatAIError(err)}`,
        type: 'analysis',
        iconKey: 'analysis'
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
