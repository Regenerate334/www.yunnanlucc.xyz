export function toMcpToolResponse({ text, structuredContent }) {
  const safeStructuredContent = structuredContent && typeof structuredContent === 'object'
    ? structuredContent
    : {};

  return {
    content: [{ type: 'text', text: text || JSON.stringify(safeStructuredContent, null, 2) }],
    structuredContent: safeStructuredContent
  };
}

export function toMcpToolError(error, fallbackMessage = 'MCP 工具调用失败') {
  const message = error?.message || String(error || fallbackMessage);
  return {
    content: [{ type: 'text', text: `${fallbackMessage}: ${message}` }],
    structuredContent: { error: message },
    isError: true
  };
}
