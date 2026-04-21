import express from 'express';
import { ReActAgent, CallbackManager } from 'llamaindex';
import { Ollama } from '@llamaindex/ollama';
import { body, validationResult } from 'express-validator';
import { agentTools } from '../../utils/agentTools.js';
import aiMiddleware from '../../utils/aiMiddleware.js';

const router = express.Router();

const getDefaultModel = () => process.env.OLLAMA_MODEL || 'gpt-oss:120b-cloud';

function writeSSE(res, payload) {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function formatOllamaError(err) {
  const msg = err?.message || String(err);
  if (msg.includes('503')) return '模型繁忙（加载中），请稍后重试。';
  return `AI 异常: ${msg.slice(0, 120)}`;
}

async function handleAIStream(req, res) {
  const { year, messages, question, model, think, deepThinking, region } = req.body;
  const isThinkingEnabled = (deepThinking ?? think) !== false;
  const selectedModel = model || getDefaultModel();

  const history = Array.isArray(messages)
    ? messages
    : (question ? [{ role: 'user', content: question }] : []);

  if (history.length === 0) {
    return res.status(400).json({ error: '请提供问题内容（messages 或 question）' });
  }

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

    // 初始状态提示 (强制步进可视化版本)
    writeSSE(res, { content: '[SEARCH] AI数据感知核心引擎 正在挂载并同步地理空间上下文...\n' });

    const currentSystemPrompt = aiMiddleware.buildSystemPrompt({
      model: selectedModel,
      thinking: isThinkingEnabled,
      region,
      year
    });

    const callbackManager = new CallbackManager({
      onEvent: (event) => {
        const { type, payload } = event;

        const toolTitleMap = {
          'clcd_analysis': (args) => `正在提取 ${args.region || '目标区域'} 土地利用遥感监测数据 (CLCD)...`,
          'dashboard_analysis': (args) => `正在汇总 ${args.region || '目标区域'} 综合指标仪表盘数据...`,
          'spatial_stats_analysis': (args) => `正在执行 ${args.region || '目标区域'} 空间重心转移与椭圆轨迹分析...`,
          'land_transfer_analysis': (args) => `正在分析 ${args.region || '目标区域'} 土地利用转移矩阵(LUCC)...`,
          'weather_query': (args) => `正在获取 ${args.city || '目标城市'} 实时气象观测数据...`,
          'knowledge_base_lookup': (args) => `正在检索专家知识库: ${args.skill_name || '专业技能'}...`,
          'map_control': (args) => `正在同步 WebGIS 空间视角: ${args.action || '操作中'}...`
        };

        if (type === 'llm-start') {
          writeSSE(res, { content: '\n[ANALYSIS] AI 逻辑引擎正在深入思考分析中...\n' });
          return;
        }

        if (type === 'tool-start' && payload?.tool?.name) {
          const toolName = payload.tool.name;
          const args = payload.tool.arguments || {};
          const statusText = toolTitleMap[toolName] ? toolTitleMap[toolName](args) : `正在运行业务组件: ${toolName}...`;
          writeSSE(res, { content: `\n[SEARCH] ${statusText}\n` });
          return;
        }

        if (type === 'tool-end' && payload?.tool?.name) {
          const toolName = payload.tool.name;
          const label = toolName.includes('analysis') ? '分析链条处理完成' : '地理数据查询完成';
          writeSSE(res, { content: `\n[ANALYSIS] ${label}\n` });

          if (payload.output?.type === 'map_command') {
            const { action, params } = payload.output;
            const commandTag = `[[MAP_COMMAND:${JSON.stringify({ action, params })}]]`;
            writeSSE(res, { content: `\n${commandTag}\n` });
          }
          return;
        }
      }
    });

    const llmHost = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    const llmOptions = {
      temperature: 0.1,
      stream: true,
      think: true,
      reasoning_content: true
    };

    const llm = new Ollama({
      model: selectedModel,
      host: llmHost,
      options: llmOptions
    });

    const agent = new ReActAgent({
      llm,
      tools: agentTools,
      callbackManager
    });

    const chatHistory = history.slice(0, -1).map((h) => ({ role: h.role, content: h.content }));
    chatHistory.unshift({ role: 'system', content: currentSystemPrompt });

    // --- 执行智能体对话 ---
    const responseStream = await agent.chat({
      message: lastUserMsg,
      chatHistory,
      stream: true
    }).catch(err => {
      const msg = err.message || String(err);
      if (msg.includes('Could not extract tool use')) {
        throw new Error(`AI 协议解析失败：模型输出格式不符合预期。请尝试更具体地描述您的 GIS 请求。`);
      }
      throw err;
    });

    // --- 流式输出驱动逻辑 ---
    // 移除之前的 LLM 劫持拦截器，改为直接监听 Agent 的流式输出响应
    // 步进器的状态依赖 CallbackManager 在 agent 运行期间主动 writeSSE 发出的 [SEARCH]/[ANALYSIS] 标签
    for await (const chunk of responseStream) {
      if (chunk.response) {
        // 由于拦截器已移除，在这里下发最终的内容片段
        writeSSE(res, { content: chunk.response });
      }
    }

    writeSSE(res, { done: true });
  } catch (err) {
    console.error('Agent Error:', err);
    if (!res.writableEnded) {
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

