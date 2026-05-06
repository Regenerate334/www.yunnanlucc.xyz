import express from 'express';
import { body, validationResult } from 'express-validator';
import { agentTools } from '../../utils/agentTools.js';
import aiMiddleware from '../../utils/aiMiddleware.js';
import pool from '../../config/db.js';
import { createDeepSeekChatCompletion, isDeepSeekOfficialModel, resolveDeepSeekModel } from '../../utils/deepseekClient.js';

const router = express.Router();

const getDefaultModel = () => process.env.CHAT_MODEL || process.env.OLLAMA_MODEL || 'deepseek-v4-flash';
const getFallbackModelCandidates = (primaryModel) => {
  const raw = process.env.OLLAMA_FALLBACK_MODELS || process.env.OLLAMA_FALLBACK_MODEL || '';
  const fallbacks = String(raw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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
const getEnableFallback = () => String(process.env.AI_STREAM_ENABLE_FALLBACK || 'false').toLowerCase() === 'true';
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
    '503',
    '502',
    '504',
    'connection reset',
    'temporarily unavailable'
  ];
  return err?.code === 'EMPTY_STREAM_RESPONSE' || keywords.some((k) => msg.includes(k));
};
const normalizeRole = (role) => {
  if (!role) return null;
  const value = String(role).toLowerCase();
  if (value === 'user' || value === 'assistant') return value;
  return null;
};
const stripInternalTags = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/\[\[MAP_COMMAND:.*?\]\]/g, '')
    .replace(/^\[(?:SEARCH|ANALYSIS)\].*$/gim, '')
    // Some model families may leak tool-call protocol markers into plain text.
    // These are never meant for end users; keep them out of the conversation memory.
    .replace(/<\|\s*DSML\s*\|>[\s\S]*?(?=<\|\s*DSML\s*\|>|$)/gi, '')
    .trim();
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
        chunkCount++;
        writeSSE(res, { content: delta.content });
      }
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
      if (answer && !usedTools) {
        writeSSE(res, { content: answer });
        return answer.length;
      }
      break;
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

    // If the tool returned a map command object, surface it to the client as [[MAP_COMMAND:...]]
    // so the front-end can act on it immediately (matches the old ReAct callback behavior).
    if (output && typeof output === 'object' && output.type === 'map_command') {
      const { action, params } = output;
      const commandTag = `[[MAP_COMMAND:${JSON.stringify({ action, params })}]]`;
      writeWorkflow(res, {
        id: `map_command_${round}_${String(action || 'action')}`,
        label: `App用户端 → 执行地图联动指令: ${action}`,
        type: 'search',
        iconKey: 'map'
      });
      writeSSE(res, { content: `\n${commandTag}\n` });
    }

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
      if (!content) return null;
      return { role, content };
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
    const len = item.content.length;
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
  thinkingEnabled = false
}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistoryBase,
    { role: 'user', content: lastUserMsg }
  ];
  const toolByName = new Map(agentTools.map((tool) => [tool.metadata.name, tool]));
  const apiModel = resolveDeepSeekModel(model);
  const maxToolRounds = 4;
  const thinking = { type: thinkingEnabled ? 'enabled' : 'disabled' };
  const reasoning_effort = thinkingEnabled ? 'high' : undefined;
  // Allow longer answers by default (especially for province-wide or multi-year analysis).
  // Users explicitly asked to relax length limits so responses don't get truncated mid-way.
  const finalMaxTokens = Number(process.env.DEEPSEEK_MAX_TOKENS ?? 8192);
  const planningMaxTokens = Number(process.env.DEEPSEEK_PLANNING_MAX_TOKENS ?? 4096);

  for (let round = 0; round < maxToolRounds; round++) {
    writeWorkflow(res, {
      id: `deepseek_tool_plan_${round}`,
      label: 'DeepSeek 官方接口 → 解析意图并规划分析路径',
      type: 'analysis',
      iconKey: 'brain',
      done: false
    });

    // Use streaming for planning to robustly capture tool_calls (arguments may be chunked in streams),
    // while still not leaking planning text to the client.
    const planningStream = await createDeepSeekChatCompletion({
      model: apiModel,
      messages,
      tools: agentTools,
      stream: true,
      options: {
        temperature: 0.1,
        top_p: 0.9,
        max_tokens: planningMaxTokens,
        thinking,
        ...(reasoning_effort ? { reasoning_effort } : {})
      }
    });

    const assistantMessage = await consumeDeepSeekStreamToMessage(planningStream);
    const toolCalls = assistantMessage.tool_calls || [];

    messages.push({
      role: 'assistant',
      content: assistantMessage.content || '',
      reasoning_content: assistantMessage.reasoning_content || undefined,
      ...(toolCalls.length ? { tool_calls: toolCalls } : {})
    });

    if (!toolCalls.length) {
      const finalText = assistantMessage.content || '';
      if (finalText) {
        writeSSE(res, { content: finalText });
        return finalText.length;
      }
      break;
    }

    for (const toolCall of toolCalls) {
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
        output = await tool.call(args);
      } catch (err) {
        output = `工具调用失败: ${err.message || String(err)}`;
      }

      writeWorkflow(res, {
        id: `tool_end_${stableToolCallKey}`,
        label: `FunctionTool: ${toolName} → ${toolName.includes('analysis') ? '分析链条处理完成' : '地理数据查询完成'}`,
        type: 'analysis',
        iconKey: 'check'
      });

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolName,
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

  const finalResponse = await createDeepSeekChatCompletion({
    model: apiModel,
    messages,
    stream: true,
    options: {
      temperature: 0.1,
      top_p: 0.9,
      max_tokens: finalMaxTokens,
      thinking,
      ...(reasoning_effort ? { reasoning_effort } : {})
    }
  });

  return streamDeepSeekResponse(finalResponse, res);
}

function formatAIError(err) {
  const msg = err?.message || String(err);
  if (err?.code === 'SESSION_CONTEXT_TOO_LARGE') return '当前会话上下文过长，请新建对话后继续。';
  if (err?.code === 'EMPTY_STREAM_RESPONSE') return '模型未返回有效内容，请稍后重试。';
  if (err?.code === 'DEEPSEEK_API_KEY_MISSING') return 'DeepSeek 官方接口未配置 API Key，请在环境变量 DEEPSEEK_API_KEY 中填写密钥。';
  if (err?.status === 401 || err?.status === 403) return 'DeepSeek 官方接口鉴权失败，请检查 DEEPSEEK_API_KEY。';
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
      'map_control': (args) => `正在同步 WebGIS 空间视角: ${args.action || '操作中'}...`
    };

    const chatHistoryBase = history.slice(0, -1).map((h) => ({ role: h.role, content: h.content }));
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
        console.info('[AI][ModelRoute]', {
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
              thinkingEnabled: isThinkingEnabled
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
            await sleep(retryDelayMs * Math.pow(2, attempt));
            continue;
          }
          break;
        }
      }
    }

    throw lastError || new Error('AI 对话失败：未知错误');
  } catch (err) {
    console.error('Agent Error:', err);
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
