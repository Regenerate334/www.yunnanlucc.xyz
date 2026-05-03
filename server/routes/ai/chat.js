import express from 'express';
import { ReActAgent, CallbackManager } from 'llamaindex';
import { Ollama } from '@llamaindex/ollama';
import { body, validationResult } from 'express-validator';
import { agentTools } from '../../utils/agentTools.js';
import aiMiddleware from '../../utils/aiMiddleware.js';
import pool from '../../config/db.js';

const router = express.Router();

const getDefaultModel = () => process.env.OLLAMA_MODEL || 'gpt-oss:120b-cloud';
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
    .trim();
};
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

function formatOllamaError(err) {
  const msg = err?.message || String(err);
  if (err?.code === 'SESSION_CONTEXT_TOO_LARGE') return '当前会话上下文过长，请新建对话后继续。';
  if (err?.code === 'EMPTY_STREAM_RESPONSE') return '模型未返回有效内容，请稍后重试。';
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
    const llmOptions = {
      temperature: 0.1,
      stream: true,
      think: true,
      reasoning_content: true
    };
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
      const chatHistory = [
        { role: 'system', content: currentSystemPrompt },
        ...chatHistoryBase
      ];

      writeWorkflow(res, {
        id: `ollama_model_${modelIndex}`,
        label: `Ollama LLM → 装载模型 ${currentModel}`,
        type: 'analysis',
        iconKey: 'analysis'
      });

      if (fallbackEnabled && modelIndex > 0) {
        writeWorkflow(res, {
          id: `ollama_fallback_${modelIndex}`,
          label: `Ollama LLM → 切换备用模型 ${currentModel}`,
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

          const callbackManager = new CallbackManager({
            onEvent: (event) => {
              const { type, payload } = event;

              if (type === 'llm-start') {
                writeWorkflow(res, {
                  id: `llm_start_${Date.now()}`,
                  label: 'Ollama LLM → 解析意图并规划分析路径',
                  type: 'analysis',
                  iconKey: 'brain',
                  done: false
                });
                return;
              }

              if (type === 'tool-start' && payload?.tool?.name) {
                const toolName = payload.tool.name;
                const args = payload.tool.arguments || {};
                const statusText = toolTitleMap[toolName] ? toolTitleMap[toolName](args) : `正在运行业务组件: ${toolName}...`;
                writeWorkflow(res, {
                  id: `tool_start_${toolName}_${Date.now()}`,
                  label: `AgentTools → 调用 FunctionTool: ${toolName} | ${statusText}`,
                  type: 'search',
                  iconKey: 'tool',
                  done: false
                });
                return;
              }

              if (type === 'tool-end' && payload?.tool?.name) {
                const toolName = payload.tool.name;
                const label = toolName.includes('analysis') ? '分析链条处理完成' : '地理数据查询完成';
                writeWorkflow(res, {
                  id: `tool_end_${toolName}_${Date.now()}`,
                  label: `FunctionTool: ${toolName} → ${label}`,
                  type: 'analysis',
                  iconKey: 'check'
                });

                if (payload.output?.type === 'map_command') {
                  const { action, params } = payload.output;
                  const commandTag = `[[MAP_COMMAND:${JSON.stringify({ action, params })}]]`;
                  writeWorkflow(res, {
                    id: `map_command_${Date.now()}`,
                    label: `App用户端 → 执行地图联动指令: ${action}`,
                    type: 'search',
                    iconKey: 'map'
                  });
                  writeSSE(res, { content: `\n${commandTag}\n` });
                }
              }
            }
          });

          const llm = new Ollama({
            model: currentModel,
            host: llmHost,
            options: llmOptions
          });

          writeWorkflow(res, {
            id: `react_router_${modelIndex}_${attempt}`,
            label: 'ReAct Router → 准备调度Agent工具链',
            type: 'analysis',
            iconKey: 'tool',
            done: false
          });

          const agent = new ReActAgent({
            llm,
            tools: agentTools,
            callbackManager
          });

          const responseStream = await agent.chat({
            message: lastUserMsg,
            chatHistory,
            stream: true
          }).catch(err => {
            const msg = err.message || String(err);
            if (msg.includes('Could not extract tool use')) {
              throw new Error('AI 协议解析失败：模型输出格式不符合预期。请尝试更具体地描述您的 GIS 请求。');
            }
            throw err;
          });

          let localChunkCount = 0;
          for await (const chunk of responseStream) {
            if (chunk.response) {
              localChunkCount++;
              writeSSE(res, { content: chunk.response });
            }
          }

          if (localChunkCount === 0) {
            throw createEmptyStreamError(currentModel);
          }

          writeWorkflow(res, {
            id: `result_${Date.now()}`,
            label: 'Result Aggregator → 汇总发现与证据链',
            type: 'analysis',
            iconKey: 'check'
          });
          writeWorkflow(res, {
            id: `sse_done_${Date.now()}`,
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
        id: `workflow_error_${Date.now()}`,
        label: `Workflow Trace → 执行失败: ${formatOllamaError(err)}`,
        type: 'analysis',
        iconKey: 'analysis'
      });
      writeSSE(res, { error: formatOllamaError(err) });
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
