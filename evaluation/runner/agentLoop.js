import aiMiddleware from '../../../../server/utils/ai/core/aiMiddleware.js';
import { createDeepSeekChatCompletion, resolveDeepSeekModel } from '../../../../server/utils/ai/core/deepseekClient.js';
import { getAgentTools } from '../../../../server/utils/ai/core/mcpClientTools.js';

const MAX_TOOL_ROUNDS = 6;

function parseToolArguments(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function pickAssistantMessage(response) {
  return response?.choices?.[0]?.message || response?.message || null;
}

function filterToolsByProfile(tools, profile) {
  if (profile === 'llm_only') return [];

  const spatialToolNames = new Set([
    'clcd_analysis',
    'dashboard_analysis',
    'land_transfer_analysis',
    'spatial_stats_analysis'
  ]);
  const knowledgeToolNames = new Set([
    'knowledge_query',
    'knowledge_base_lookup',
    'knowledge_graph_query',
    'policy_reference_lookup'
  ]);

  if (profile === 'spatial_tools') {
    return tools.filter((tool) => spatialToolNames.has(tool.metadata?.name));
  }
  if (profile === 'knowledge_tools') {
    return tools.filter((tool) => knowledgeToolNames.has(tool.metadata?.name));
  }
  return tools;
}

async function callToolDetailed(tool, args) {
  const startedAt = Date.now();
  try {
    if (typeof tool.callDetailed === 'function') {
      const result = await tool.callDetailed(args);
      return {
        elapsed_ms: Date.now() - startedAt,
        text: result.text || '',
        structuredContent: result.structuredContent || null,
        is_error: !!result.isError
      };
    }
    const text = await tool.call(args);
    return {
      elapsed_ms: Date.now() - startedAt,
      text,
      structuredContent: null,
      is_error: String(text || '').startsWith('工具调用失败')
    };
  } catch (err) {
    return {
      elapsed_ms: Date.now() - startedAt,
      text: `工具调用失败: ${err?.message || String(err)}`,
      structuredContent: { error: err?.message || String(err) },
      is_error: true
    };
  }
}

export async function runAgentTask(task, {
  model = process.env.EVAL_MODEL || process.env.CHAT_MODEL || process.env.OLLAMA_MODEL || 'deepseek-v4-pro',
  profile = 'full',
  region = '云南省',
  year = 2023
} = {}) {
  const startedAt = Date.now();
  const allTools = await getAgentTools();
  const tools = filterToolsByProfile(allTools, profile);
  const toolByName = new Map(tools.map((tool) => [tool.metadata.name, tool]));
  const trace = [];

  const systemPrompt = aiMiddleware.buildSystemPrompt({
    model,
    thinking: false,
    region,
    year
  });

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: task.question }
  ];

  let finalAnswer = '';
  let lastResponse = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const options = {
      temperature: 0,
      top_p: 1,
      max_tokens: Number(process.env.EVAL_STEP_MAX_TOKENS || 4096)
    };
    if (tools.length > 0) options.tool_choice = 'auto';

    let response;
    try {
      response = await createDeepSeekChatCompletion({
        model: resolveDeepSeekModel(model),
        messages,
        tools,
        stream: false,
        options
      });
    } catch (err) {
      const msg = String(err?.message || err);
      if (!msg.toLowerCase().includes('tool_choice')) throw err;
      delete options.tool_choice;
      response = await createDeepSeekChatCompletion({
        model: resolveDeepSeekModel(model),
        messages,
        tools,
        stream: false,
        options
      });
    }

    lastResponse = response;
    const assistantMessage = pickAssistantMessage(response);
    if (!assistantMessage) break;

    const toolCalls = Array.isArray(assistantMessage.tool_calls)
      ? assistantMessage.tool_calls
      : [];

    messages.push({
      role: 'assistant',
      content: assistantMessage.content || '',
      ...(toolCalls.length ? { tool_calls: toolCalls } : {})
    });

    if (!toolCalls.length) {
      finalAnswer = assistantMessage.content || '';
      break;
    }

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function?.name;
      const args = parseToolArguments(toolCall.function?.arguments);
      const tool = toolByName.get(toolName);

      if (!tool) {
        const text = `工具不存在: ${toolName}`;
        trace.push({ round, tool_name: toolName, args, elapsed_ms: 0, text, structuredContent: null, is_error: true });
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: text
        });
        continue;
      }

      const result = await callToolDetailed(tool, args);
      trace.push({
        round,
        tool_name: toolName,
        args,
        ...result
      });

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolName,
        content: result.text || JSON.stringify(result.structuredContent || {}, null, 2)
      });
    }
  }

  if (!finalAnswer) {
    const response = await createDeepSeekChatCompletion({
      model: resolveDeepSeekModel(model),
      messages,
      tools: [],
      stream: false,
      options: {
        temperature: 0,
        top_p: 1,
        max_tokens: Number(process.env.EVAL_FINAL_MAX_TOKENS || 4096)
      }
    });
    lastResponse = response;
    finalAnswer = pickAssistantMessage(response)?.content || '';
  }

  return {
    profile,
    model: resolveDeepSeekModel(model),
    elapsed_ms: Date.now() - startedAt,
    final_answer: finalAnswer,
    trace,
    response_id: lastResponse?.id || null
  };
}
