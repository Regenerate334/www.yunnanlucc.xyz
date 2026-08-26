/**
 * MCP Server 入口 (STDIO 模式)
 *
 * 职责：
 * - 启动 MCP Server 并注册 resources/tools
 * - MCP 仅作为协议适配层：复用系统已有能力，不在此堆叠业务逻辑
 *
 * 资源位置：
 * - skills / policy / knowledge graph / ontology / catalog 等统一归档在 server/knowledge/
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import logger from '../config/logger.js';

import { registerSkillsResource } from './resources/skillsResource.js';
import { registerClcdAnalysisTool } from './tools/clcdAnalysisTool.js';
import { registerDashboardAnalysisTool } from './tools/dashboardAnalysisTool.js';
import { registerKnowledgeQueryTool } from './tools/knowledgeQueryTool.js';
import { registerLandTransferAnalysisTool } from './tools/landTransferAnalysisTool.js';
import { registerSpatialStatsAnalysisTool } from './tools/spatialStatsAnalysisTool.js';
import { registerKnowledgeBaseLookupTool } from './tools/knowledgeBaseLookupTool.js';
import { registerKnowledgeGraphQueryTool } from './tools/knowledgeGraphQueryTool.js';
import { registerPolicyReferenceLookupTool } from './tools/policyReferenceLookupTool.js';
import { registerWeatherQueryTool } from './tools/weatherQueryTool.js';
import { registerWebFetchTool } from './tools/webFetchTool.js';

const server = new McpServer({
  name: 'WebGIS-Professional-Server',
  version: '1.0.0'
});

// Resources
registerSkillsResource(server);

// Tools
registerClcdAnalysisTool(server);
registerDashboardAnalysisTool(server);
registerKnowledgeQueryTool(server);
registerLandTransferAnalysisTool(server);
registerSpatialStatsAnalysisTool(server);
registerKnowledgeBaseLookupTool(server);
registerKnowledgeGraphQueryTool(server);
registerPolicyReferenceLookupTool(server);
registerWeatherQueryTool(server);
registerWebFetchTool(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('WebGIS MCP Server 已启动 (STDIO 模式)');
}

main().catch((err) => {
  logger.error('MCP Server 启动失败', { message: err?.message || String(err), stack: err?.stack });
  process.exit(1);
});
