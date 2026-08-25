import { callMcpToolDetailed } from '../../../../server/utils/ai/core/mcpClientTools.js';
import { extractBaselineValue } from './extractors.js';

export async function runBaseline(task) {
  if (!task?.baseline?.tool) return null;

  const startedAt = Date.now();
  const result = await callMcpToolDetailed(task.baseline.tool, task.baseline.args || {});
  const elapsed_ms = Date.now() - startedAt;
  const value = extractBaselineValue(result.structuredContent, task.baseline.extract || {});

  return {
    tool: task.baseline.tool,
    args: task.baseline.args || {},
    elapsed_ms,
    is_error: !!result.isError,
    value,
    structuredContent: result.structuredContent,
    text: result.text
  };
}
