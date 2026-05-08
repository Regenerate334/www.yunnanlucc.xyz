/**
 * DeepSeek 大模型客户端 (DeepSeek LLM Client)
 * 职责：封装与 DeepSeek API 的网络通信，处理流式请求 (SSE)、Token 计费及重试机制。
 *
 * 修改提示：
 * 1. 连接失败或超时时需提供优雅降级（如退回基础模型或给出明确错误提示）。
 * 2. 请确保 `apiKey` 仅在服务端环境变量中读取，严禁明文硬编码。
 * 3. 流式解析 (chunk parsing) 逻辑对于断流和粘包较为敏感，修改时需严密测试。
 */
import { ToolCallLLM } from '@llamaindex/core/llms';
import { extractText } from '@llamaindex/core/utils';

const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
// DeepSeek 官方接口在高峰期可能出现排队/超时；给一个可配置的客户端超时，
// 以便更快触发重试/降级，避免长时间挂起。
const DEFAULT_DEEPSEEK_REQUEST_TIMEOUT_MS = 115000;
const LEGACY_CLOUD_MODELS = new Set([
  'deepseek-v3.1:671b-cloud',
  'deepseek-v3.1-671b-cloud',
  'deepseek-v3.1 671b'
]);

const normalizeModelName = (model = '') => String(model).trim().toLowerCase();
const getDeepSeekRequestTimeoutMs = () => {
  const raw = process.env.DEEPSEEK_REQUEST_TIMEOUT_MS ?? process.env.DEEPSEEK_TIMEOUT_MS;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_DEEPSEEK_REQUEST_TIMEOUT_MS;
  return Math.floor(value);
};

export function isDeepSeekOfficialModel(model) {
  const normalized = normalizeModelName(model);
  return normalized === DEFAULT_DEEPSEEK_MODEL || LEGACY_CLOUD_MODELS.has(normalized);
}

export function resolveDeepSeekModel(model) {
  return isDeepSeekOfficialModel(model) ? DEFAULT_DEEPSEEK_MODEL : model;
}

function requireDeepSeekApiKey() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    const err = new Error('DeepSeek 官方接口未配置 DEEPSEEK_API_KEY');
    err.code = 'DEEPSEEK_API_KEY_MISSING';
    throw err;
  }
  return apiKey;
}

function toDeepSeekMessages(messages = []) {
  const normalized = messages
    .map((message) => {
      const out = {
        role: message.role === 'memory' ? 'assistant' : message.role,
        content: message.content == null ? '' : extractText(message.content),
        reasoning_content: message.reasoning_content ?? undefined,
        // DeepSeek tool role requires the function name in addition to tool_call_id/content.
        // Keep it optional to avoid breaking non-tool flows.
        name: message.name ?? undefined,
        tool_call_id: message.tool_call_id,
        tool_calls: message.tool_calls
      };

      // Some models reject empty tool_calls arrays; omit them.
      if (Array.isArray(out.tool_calls) && out.tool_calls.length === 0) delete out.tool_calls;
      return out;
    })
    .filter((message) => ['system', 'user', 'assistant', 'tool'].includes(message.role));

  // Keep empty content for `tool` messages (the important field is tool_call_id/content).
  // For other roles, filter out empty records.
  return normalized.filter((message) => message.role === 'tool' || message.content || message.tool_calls);
}

function cleanJsonSchema(value) {
  if (Array.isArray(value)) return value.map(cleanJsonSchema);
  if (!value || typeof value !== 'object') return value;
  const cleaned = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === '$schema') continue;
    cleaned[key] = cleanJsonSchema(item);
  }
  return cleaned;
}

export function toDeepSeekTools(tools = []) {
  const baseURL = String(process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL);
  const strictEnabled = baseURL.includes('/beta');
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.metadata.name,
      description: tool.metadata.description,
      parameters: cleanJsonSchema(tool.metadata.parameters || { type: 'object', properties: {} }),
      ...(strictEnabled
        ? {
            // DeepSeek strict-mode: enforce tool-call arguments to match the JSON schema (Beta).
            // This greatly reduces protocol drift (e.g., DSML leakage / malformed JSON).
            strict: true
          }
        : {})
    }
  }));
}

async function parseDeepSeekError(response) {
  const retryAfterHeader = response.headers?.get?.('retry-after');
  const retryAfterFromHeader = retryAfterHeader ? Number(retryAfterHeader) : null;
  const text = await response.text();
  let detail = text;
  try {
    const json = JSON.parse(text);
    detail = json?.error?.message || json?.message || json?.detail || json?.title || text;
    const err = new Error(`DeepSeek API ${response.status}: ${detail}`);
    err.status = response.status;
    if (json?.retry_after != null && Number.isFinite(Number(json.retry_after))) {
      err.retryAfter = Number(json.retry_after);
    } else if (retryAfterFromHeader != null && Number.isFinite(retryAfterFromHeader)) {
      err.retryAfter = retryAfterFromHeader;
    }
    if (json?.retryable !== undefined) err.retryable = !!json.retryable;
    if (json?.error_code != null) err.errorCode = json.error_code;
    if (json?.error_name) err.errorName = json.error_name;
    return err;
  } catch {
    // 保留原始响应文本
  }
  const err = new Error(`DeepSeek API ${response.status}: ${detail}`);
  err.status = response.status;
  if (retryAfterFromHeader != null && Number.isFinite(retryAfterFromHeader)) {
    err.retryAfter = retryAfterFromHeader;
  }
  return err;
}

export class DeepSeekOfficialLLM extends ToolCallLLM {
  constructor(params = {}) {
    super();
    this.model = resolveDeepSeekModel(params.model || DEFAULT_DEEPSEEK_MODEL);
    this.baseURL = (params.baseURL || process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL).replace(/\/$/, '');
    this.options = {
      temperature: 0.1,
      top_p: 0.9,
      max_tokens: 4096,
      ...params.options
    };
    this.supportToolCall = true;
  }

  get metadata() {
    return {
      model: this.model,
      temperature: this.options.temperature,
      topP: this.options.top_p,
      maxTokens: this.options.max_tokens,
      contextWindow: 32768,
      tokenizer: undefined,
      structuredOutput: true
    };
  }

  async requestChat(payload) {
    return requestDeepSeekChat(payload, this.baseURL);
  }

  buildPayload(params, stream) {
    const payload = {
      model: this.model,
      messages: toDeepSeekMessages(params.messages),
      stream,
      temperature: this.options.temperature,
      top_p: this.options.top_p,
      max_tokens: this.options.max_tokens
    };

    if (params.tools?.length) {
      payload.tools = toDeepSeekTools(params.tools);
    }

    return payload;
  }

  async chat(params) {
    const payload = this.buildPayload(params, !!params.stream);

    if (!params.stream) {
      const response = await this.requestChat(payload);
      const json = await response.json();
      const message = json.choices?.[0]?.message || { role: 'assistant', content: '' };
      return {
        message: this.toLlamaIndexMessage(message),
        raw: json
      };
    }

    const response = await this.requestChat(payload);
    return this.parseStream(response);
  }

  async complete(params) {
    const message = { role: 'user', content: extractText(params.prompt) };
    const result = await this.chat({ messages: [message], stream: !!params.stream });
    if (params.stream) {
      return (async function* () {
        for await (const chunk of result) {
          yield { text: chunk.delta, raw: chunk.raw };
        }
      })();
    }
    return { text: result.message.content, raw: result.raw };
  }

  toLlamaIndexMessage(message) {
    const toolCalls = message.tool_calls || [];
    if (toolCalls.length) {
      return {
        role: 'assistant',
        content: message.content || '',
        options: {
          toolCall: toolCalls.map((toolCall) => ({
            name: toolCall.function?.name,
            input: this.parseToolArguments(toolCall.function?.arguments),
            id: toolCall.id
          }))
        }
      };
    }
    return {
      role: 'assistant',
      content: message.content || ''
    };
  }

  parseToolArguments(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  async *parseStream(response) {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

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
        const text = delta.content || delta.reasoning_content || '';
        if (text) {
          yield { raw: json, delta: text };
        }
      }
    }
  }
}

export async function requestDeepSeekChat(payload, baseURL = process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL) {
  const normalizedBaseURL = baseURL.replace(/\/$/, '');
  const timeoutMs = getDeepSeekRequestTimeoutMs();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    const acceptHeader = payload?.stream ? 'text/event-stream' : 'application/json';
    response = await fetch(`${normalizedBaseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // When stream=true, the response is SSE; otherwise JSON.
        Accept: acceptHeader,
        Authorization: `Bearer ${requireDeepSeekApiKey()}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (err) {
    // fetch() 被 AbortController 中断时，会抛 AbortError；转换成统一错误码以便上层重试/降级。
    const name = err?.name || '';
    const code = err?.code || '';
    if (name === 'AbortError' || code === 'ABORT_ERR') {
      const e = new Error(`DeepSeek API timeout after ${timeoutMs}ms`);
      e.code = 'DEEPSEEK_REQUEST_TIMEOUT';
      e.timeoutMs = timeoutMs;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) throw await parseDeepSeekError(response);
  return response;
}

export async function createDeepSeekChatCompletion({ model, messages, tools = [], stream = false, options = {} }) {
  const payload = {
    model: resolveDeepSeekModel(model || DEFAULT_DEEPSEEK_MODEL),
    messages: toDeepSeekMessages(messages),
    stream,
    temperature: options.temperature ?? 0.1,
    top_p: options.top_p ?? 0.9,
    max_tokens: options.max_tokens ?? 4096
  };

  // DeepSeek V4: thinking mode is controlled via `thinking`, with optional `reasoning_effort`.
  // (When thinking mode is enabled and tool-calls happen, callers must round-trip reasoning_content.)
  if (options.thinking && typeof options.thinking === 'object') payload.thinking = options.thinking;
  if (options.reasoning_effort) payload.reasoning_effort = options.reasoning_effort;
  if (options.user_id) payload.user_id = options.user_id;

  if (tools.length) {
    payload.tools = toDeepSeekTools(tools);
  }

  // DeepSeek supports OpenAI-compatible `tool_choice` in non-thinking mode.
  // Note: some client integrations report that DeepSeek V4 thinking mode may reject tool_choice,
  // so callers should avoid passing tool_choice when thinking.type === "enabled".
  if (options.tool_choice !== undefined) payload.tool_choice = options.tool_choice;

  const response = await requestDeepSeekChat(payload);
  return stream ? response : response.json();
}

export async function generateDeepSeekText(messages, opts = {}) {
  const llm = new DeepSeekOfficialLLM({
    model: opts.model,
    options: {
      temperature: opts.temperature ?? 0.2,
      top_p: opts.topP ?? 0.9,
      max_tokens: opts.maxTokens ?? 4096
    }
  });
  const response = await llm.chat({
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content
    })),
    stream: false
  });
  return response.message.content || '';
}
