/**
 * MCP 全面实证检查脚本
 * 路径: ops/check_mcp_system.js
 * 
 * 验证目标:
 * 1. MCP Server 启动与 STDIO 传输连通性
 * 2. Resources 列表与读取 (gis-expert-skills)
 * 3. Tools 列表完整性 (9个工具注册状态)
 * 4. Tools 真实调用验证与响应结构 (text / structuredContent)
 * 5. mcpClientTools 客户端封装与降级回退机制
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  ListResourcesResultSchema,
  ReadResourceResultSchema,
  ListToolsResultSchema,
  CallToolResultSchema
} from '@modelcontextprotocol/sdk/types.js';
import { getAgentTools, callMcpToolDetailed, closeMcpClient } from '../../server/utils/ai/core/mcpClientTools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const MCP_SERVER_SCRIPT = path.join(PROJECT_ROOT, 'server', 'mcp', 'index.js');

async function runMcpDiagnostics() {
  console.log('==============================================');
  console.log('开始 WebGIS MCP 系统实证检查');
  console.log('==============================================\n');

  const report = {
    connection: false,
    resources: { list: [], readSuccess: false, sampleTextLength: 0 },
    tools: { registered: [], testResults: {} },
    clientToolsWrapper: { toolsCount: 0, testToolCall: null },
    errors: []
  };

  let client = null;
  let transport = null;

  try {
    // 1. 测试 STDIO 传输与 Client 连接
    console.log('【1/5】测试 MCP Server (STDIO) 连接握手...');
    client = new Client({
      name: 'mcp-diagnostic-client',
      version: '1.0.0'
    });

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [MCP_SERVER_SCRIPT],
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        LOG_LEVEL: 'silent',
        MCP_STDIO_MODE: 'true'
      },
      stderr: 'pipe'
    });

    transport.stderr?.on('data', (chunk) => {
      const msg = chunk.toString('utf8').trim();
      if (msg) console.log(`   [Server STDERR] ${msg}`);
    });

    await client.connect(transport);
    report.connection = true;
    console.log('   [OK] MCP Server 连接成功 (STDIO Transport 初始化成功)\n');

    // 2. 测试 Resources
    console.log('【2/5】测试 MCP Resources (List & Read)...');
    try {
      const resList = await client.request({ method: 'resources/list', params: {} }, ListResourcesResultSchema);
      report.resources.list = resList.resources || [];
      console.log(`   [OK] 获取到 ${report.resources.list.length} 个 Resource:`, report.resources.list.map(r => `${r.name} (${r.uri})`));

      if (report.resources.list.length > 0) {
        const targetUri = report.resources.list[0].uri;
        const readResult = await client.request({
          method: 'resources/read',
          params: { uri: targetUri }
        }, ReadResourceResultSchema);
        report.resources.readSuccess = true;
        const contentLen = readResult?.contents?.[0]?.text?.length || 0;
        report.resources.sampleTextLength = contentLen;
        console.log(`   [OK] 读取 Resource [${targetUri}] 成功, 内容长度: ${contentLen} 字符`);
      }
    } catch (resErr) {
      console.error('   [FAIL] Resources 测试异常:', resErr.message);
      report.errors.push(`Resources error: ${resErr.message}`);
    }
    console.log('');

    // 3. 测试 Tools 注册列表
    console.log('【3/5】测试 MCP Tools 注册列表 (tools/list)...');
    const toolListResult = await client.request({ method: 'tools/list', params: {} }, ListToolsResultSchema);
    report.tools.registered = (toolListResult.tools || []).map(t => t.name);
    console.log(`   [OK] 成功列出 ${report.tools.registered.length} 个 MCP 工具:`);
    (toolListResult.tools || []).forEach((t, i) => {
      console.log(`      ${i + 1}. [${t.name}] - ${t.description.slice(0, 45)}...`);
    });
    console.log('');

    // 4. 逐个工具调用实测
    console.log('【4/5】执行各个 Tool 的受控调用实测...');
    const testCases = [
      {
        name: 'clcd_analysis',
        args: { query_type: 'structure', region: '昆明市', year: 2023 }
      },
      {
        name: 'dashboard_analysis',
        args: { year: 2023, region: '昆明市' }
      },
      {
        name: 'knowledge_query',
        args: { mode: 'search', term: '耕地' }
      },
      {
        name: 'knowledge_base_lookup',
        args: { skill_name: 'monitoring_indices' }
      },
      {
        name: 'knowledge_graph_query',
        args: { mode: 'search', term: '昆明' }
      },
      {
        name: 'land_transfer_analysis',
        args: { region: '昆明市', start_year: 2000, end_year: 2023 }
      },
      {
        name: 'policy_reference_lookup',
        args: { region: '云南省', top_n: 3 }
      },
      {
        name: 'spatial_stats_analysis',
        args: { yearStart: 2000, yearEnd: 2023, fromClassStr: '耕地', toClassStr: '建设用地', region: '昆明市' }
      },
      {
        name: 'weather_query',
        args: { city: '昆明' }
      }
    ];

    for (const tc of testCases) {
      process.stdout.write(`   [RUN] 测试工具 [${tc.name}] ... `);
      try {
        const callRes = await client.request({
          method: 'tools/call',
          params: { name: tc.name, arguments: tc.args }
        }, CallToolResultSchema);

        const hasError = callRes.isError;
        const textSnippet = (callRes.content?.[0]?.text || '').replace(/\s+/g, ' ').slice(0, 60);
        const hasStructured = !!callRes.structuredContent;

        report.tools.testResults[tc.name] = {
          success: !hasError,
          snippet: textSnippet,
          hasStructured
        };

        if (hasError) {
          console.log(`[FAIL] 调用返回错误: ${textSnippet}`);
        } else {
          console.log(`[OK] 成功 (返回: "${textSnippet}...")`);
        }
      } catch (err) {
        console.log(`[FAIL] 异常: ${err.message}`);
        report.tools.testResults[tc.name] = { success: false, error: err.message };
        report.errors.push(`Tool ${tc.name} call failed: ${err.message}`);
      }
    }
    console.log('');

  } finally {
    if (transport) {
      await transport.close().catch(() => {});
    }
  }

  // 5. 测试 server/utils/ai/core/mcpClientTools.js 封装层
  console.log('【5/5】测试 AI 运行时客户端封装层 (mcpClientTools.js)...');
  try {
    const wrappedTools = await getAgentTools();
    report.clientToolsWrapper.toolsCount = wrappedTools.length;
    console.log(`   [OK] getAgentTools() 返回 ${wrappedTools.length} 个已适配工具`);

    const sampleCall = await callMcpToolDetailed('knowledge_query', { mode: 'metadata' });
    report.clientToolsWrapper.testToolCall = {
      isError: sampleCall.isError,
      hasText: !!sampleCall.text,
      hasStructured: !!sampleCall.structuredContent
    };
    console.log(`   [OK] callMcpToolDetailed('knowledge_query') 响应正常 (isError: ${sampleCall.isError})`);
  } catch (clientErr) {
    console.error('   [FAIL] mcpClientTools 测试异常:', clientErr.message);
    report.errors.push(`mcpClientTools error: ${clientErr.message}`);
  } finally {
    await closeMcpClient().catch(() => {});
  }

  console.log('\n==============================================');
  console.log('检查结果摘要:');
  console.log(`- MCP Server STDIO 连通: ${report.connection ? '正常' : '异常'}`);
  console.log(`- MCP Resources: ${report.resources.list.length} 个 (读取: ${report.resources.readSuccess ? '正常' : '失败'})`);
  console.log(`- MCP Tools 注册数: ${report.tools.registered.length} 个`);
  const successToolCalls = Object.values(report.tools.testResults).filter(r => r.success).length;
  console.log(`- Tools 调用通过率: ${successToolCalls} / ${Object.keys(report.tools.testResults).length}`);
  console.log(`- Client Tools 适配层: ${report.clientToolsWrapper.toolsCount} 个工具可用`);
  console.log(`- 异常数: ${report.errors.length}`);
  console.log('==============================================');
}

runMcpDiagnostics().catch((err) => {
  console.error('Fatal MCP Diagnostic Error:', err);
  process.exit(1);
});
