import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';
import logger from '../../../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const MCP_SERVER_SCRIPT = path.join(PROJECT_ROOT, 'server', 'mcp', 'index.js');
const MCP_TOOL_CACHE_TTL_MS = Number(process.env.MCP_TOOL_CACHE_TTL_MS || 60000);
const MCP_RETRY_COOLDOWN_MS = Number(process.env.MCP_RETRY_COOLDOWN_MS || 30000);

let client = null;
let transport = null;
let clientPromise = null;
let cachedTools = null;
let cachedAt = 0;
let retryAfter = 0;
let localAgentToolsCache = null;

function normalizeEnv() {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = String(value);
  }
  env.LOG_LEVEL = 'silent';
  env.MCP_STDIO_MODE = 'true';
  return env;
}

async function fallbackTools() {
  if (!localAgentToolsCache) {
    const mod = await import('./agentTools.js');
    localAgentToolsCache = mod.agentTools || [];
  }

  return localAgentToolsCache.map((tool) => ({
    metadata: {
      ...tool.metadata,
      source: 'local'
    },
    call: (args) => tool.call(args)
  }));
}

function contentToText(result) {
  const blocks = Array.isArray(result?.content) ? result.content : [];
  const contentText = blocks
    .map((item) => {
      if (item?.type === 'text') return item.text || '';
      if (item?.text) return item.text;
      return JSON.stringify(item);
    })
    .filter(Boolean)
    .join('\n');

  if (contentText) return result?.isError ? `工具调用失败: ${contentText}` : contentText;
  if (result?.structuredContent) return JSON.stringify(result.structuredContent, null, 2);
  return result?.isError ? '工具调用失败: MCP Server 未返回有效内容' : '';
}

async function connectMcpClient() {
  if (client) return client;
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const nextClient = new Client({
      name: 'webgis-ai-mcp-client',
      version: '1.0.0'
    });

    const nextTransport = new StdioClientTransport({
      command: process.execPath,
      args: [MCP_SERVER_SCRIPT],
      cwd: PROJECT_ROOT,
      env: normalizeEnv(),
      stderr: 'pipe'
    });

    nextTransport.onerror = (error) => {
      logger.warn('[MCP Client] transport error', { message: error?.message || String(error) });
    };
    nextTransport.onclose = () => {
      client = null;
      transport = null;
      clientPromise = null;
      cachedTools = null;
      cachedAt = 0;
    };
    nextTransport.stderr?.on('data', (chunk) => {
      const text = chunk?.toString?.('utf8')?.trim();
      if (text) logger.debug('[MCP Server stderr]', { message: text });
    });

    await nextClient.connect(nextTransport);
    client = nextClient;
    transport = nextTransport;
    return client;
  })();

  try {
    return await clientPromise;
  } catch (err) {
    client = null;
    transport = null;
    clientPromise = null;
    retryAfter = Date.now() + MCP_RETRY_COOLDOWN_MS;
    throw err;
  }
}

async function listMcpTools() {
  const activeClient = await connectMcpClient();
  const result = await activeClient.request({ method: 'tools/list', params: {} }, ListToolsResultSchema);
  return Array.isArray(result?.tools) ? result.tools : [];
}

async function callMcpTool(name, args = {}) {
  const activeClient = await connectMcpClient();
  const result = await activeClient.request({
    method: 'tools/call',
    params: {
      name,
      arguments: args && typeof args === 'object' ? args : {}
    }
  }, CallToolResultSchema);
  return contentToText(result);
}

function toAgentTool(tool) {
  return {
    metadata: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema || { type: 'object', properties: {} },
      source: 'mcp'
    },
    call: (args) => callMcpTool(tool.name, args)
  };
}

export async function getAgentTools() {
  if (String(process.env.AI_USE_MCP_TOOLS || 'true').toLowerCase() === 'false') {
    return fallbackTools();
  }

  if (cachedTools && Date.now() - cachedAt < MCP_TOOL_CACHE_TTL_MS) {
    return cachedTools;
  }

  if (Date.now() < retryAfter) {
    return fallbackTools();
  }

  try {
    const tools = await listMcpTools();
    if (!tools.length) throw new Error('MCP Server 未返回工具列表');
    cachedTools = tools.map(toAgentTool);
    cachedAt = Date.now();
    return cachedTools;
  } catch (err) {
    logger.warn('[MCP Client] fallback to local agentTools', { message: err?.message || String(err) });
    return fallbackTools();
  }
}

export async function closeMcpClient() {
  const activeTransport = transport;
  client = null;
  transport = null;
  clientPromise = null;
  cachedTools = null;
  cachedAt = 0;
  if (activeTransport) await activeTransport.close();
}
