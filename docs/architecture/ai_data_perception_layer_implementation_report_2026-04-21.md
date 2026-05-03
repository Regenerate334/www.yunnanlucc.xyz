# AI 数据感知层技术实现报告（MCP + 知识图谱）

- 项目：`www.yunnanlucc.xyz`
- 报告日期：`2026-04-21`
- 报告范围：`server/mcp`、`ops/ai`、`package.json` 中 AI 数据感知层相关实现
- 编码约束：**全链路 UTF-8**

## 1. 目标与结论

### 1.1 目标
本次工作的目标是把原先“只有节点、没有关系边”的知识图谱，升级为可供 MCP 工具实际推理和调用的语义图层，并验证 AI 侧可调用性。

### 1.2 结论
- 结论一：已完成“可连边语义图谱”落地，`knowledge_graph.json` 从 `0 links` 提升为 `1402 links`。
- 结论二：`knowledge_query` 工具已完成端到端可调用验证（MCP stdio 客户端实际调用通过）。
- 结论三：已形成可复现实验命令与构建流程，满足论文“技术实现参照”要求。

## 2. 原始问题与根因

### 2.1 发现的问题
- 图谱文件存在节点，但 `links` 为空，导致 `traverse/path/resolve` 语义能力基本不可用。
- 构建脚本只做节点装载，没有有效关系构建逻辑。
- `knowledge_base.json` 的迁移时段抽取规则与数据库列命名不一致，导致 `transfer_periods` 为空。

### 2.2 根因分析
- 旧脚本按 `^[0-9]{4}_to_[0-9]{4}$` 抽列，但实际列是 `y8590_11` 这类编码形式。
- 旧图谱构建没有真正调用 `addLink` 建立实体间语义关系。
- MCP 查询工具侧对“仅入边节点”可解释性不足（仅看出边时容易出现空结果）。

## 3. 架构设计（AI 数据感知层）

AI 数据感知层分为四层：

1. 数据源层（PostgreSQL）
- 行政/统计：`clcd_province`、`clcd_prefecture`、`clcd_county`
- 空间统计：`spatial_county_yunnan_stats`
- 转移矩阵：`spatial_county_yunnan_transfer`

2. 知识构建层（`ops/ai`）
- `build_knowledge_graph.js`：构建 `knowledge_base.json`（年序列、区域列表、迁移时段、表规模摘要）
- `build_real_kg.js`：构建 `knowledge_graph.json`（节点 + 关系边）

3. 语义服务层（MCP，`server/mcp/index.js`）
- 对外暴露 `knowledge_query` 工具
- 支持 `metadata/search/traverse/resolve/path`
- 查询源为 `knowledge_graph.json`

4. AI 调用层（LLM Agent）
- 通过 MCP 调用 `tools/list` + `tools/call`
- 结合图谱关系提供语义检索、路径发现、概念解析

## 4. 数据模型与关系语义

### 4.1 节点类型
- `Region`
- `LandUseType`
- `Indicator`
- `Policy`
- `Condition`
- `TransferPeriod`

### 4.2 关系类型（与 ontology 对齐）
- `located_in`
- `adjacent_to`
- `contributes_to`
- `impacts_at`
- `mapped_to_condition`
- `transfers_path`

## 5. 关键实现细节

### 5.1 `ops/ai/build_knowledge_graph.js`（重写）
- 使用 UTF-8 显式读写：`readFile(..., 'utf8')` / `writeFile(..., 'utf8')`
- 修复迁移时段抽取：
  - 支持 `y8590_11` 这类列名
  - 解析为 `1985->1990` 等标准化 period
- 产出：
  - `entities.years`
  - `entities.regions`
  - `entities.transfer_periods`
  - `summary.tables`

### 5.2 `ops/ai/build_real_kg.js`（重写）
- 构建 Region 主干：
  - 省节点：`region:yunnan`
  - 州市节点：来自 `spatial_county_yunnan_stats.地级`
  - 县节点：来自 `spatial_county_yunnan_stats.地名`
  - `county -> prefecture -> province` 的 `located_in`
- 构建邻接关系：
  - `ST_Touches` 计算县域几何邻接，生成 `adjacent_to`
- 构建地类/指标关系：
  - 从 ontology 权重生成 `contributes_to`
- 构建政策关系：
  - `policy -> region:yunnan` 的 `impacts_at`
- 构建风险映射：
  - `indicator -> condition` 的 `mapped_to_condition`
- 构建转移路径：
  - 解析转移列 `yXXXX_ij`
  - 生成 `transfers_path`（含 period、强度分级、面积总量等属性）

### 5.3 `server/mcp/index.js`（增强）
- `knowledge_query` 增强点：
  - `traverse`：同时支持出边与入边结果展示
  - `resolve`：上下文逻辑同时展示入边与出边
  - `path`：支持更稳健的两跳路径发现（含方向信息）
  - 可选 relation 过滤

### 5.4 `package.json`（新增构建脚本）
- `mcp:build:kb`
- `mcp:build:kg`
- `mcp:build`（串联执行）

## 6. 实测与验证

## 6.1 构建执行验证
执行命令：

```bash
npm run mcp:build
```

结果：
- `knowledge_base.json` 构建成功
- `knowledge_graph.json` 构建成功
- 警告：`yunnan_boundaries` 表不存在（仅影响摘要，不影响图谱主功能）

### 6.2 图谱结构一致性验证
关键结果（当前版本）：
- 节点数：`200`
- 关系边数：`1402`
- 坏边引用（source/target 不存在）：`0`
- 关系类型与 ontology 对齐：**完全一致**（无缺失、无额外）

关系数量统计：
- `located_in`: `145`
- `adjacent_to`: `664`
- `contributes_to`: `18`
- `impacts_at`: `3`
- `mapped_to_condition`: `16`
- `transfers_path`: `556`

节点类型统计：
- `Region`: `146`
- `LandUseType`: `9`
- `Indicator`: `4`
- `Policy`: `3`
- `Condition`: `4`
- `TransferPeriod`: `34`

### 6.3 MCP 端到端调用验证（AI 可调用性）
测试方式：
- 使用 `@modelcontextprotocol/sdk` 的 `Client + StdioClientTransport`
- 直接拉起 `node server/mcp/index.js`
- 执行 `tools/list` 与 `knowledge_query` 多模式 `tools/call`

关键结果：
- 连接成功：`connected=true`
- 工具列表包含：`clcd_analysis`、`dashboard_analysis`、`knowledge_query`
- `knowledge_query(metadata)` 返回有效图谱统计：
  - `nodes=200`
  - `links=1402`
  - 6 类关系
- `knowledge_query(traverse)` 可返回云南省入边行政层级关系
- `knowledge_query(path)` 可返回地类到指标的直接路径与两跳路径

结论：**AI 已可通过 MCP 调用该语义层。**

## 7. UTF-8 编码规范（必须遵守）

本项目 AI 数据感知层文件必须统一 UTF-8：
- `server/mcp/*.json`
- `server/mcp/index.js`
- `ops/ai/*.js`
- `docs/**/*.md`

强制规范：
1. Node 文件读写必须显式 `utf8`。
2. 禁止使用可能触发系统代码页误读的整文件覆盖方式（例如 PowerShell 默认代码页链路）。
3. 构建与测试脚本保持 UTF-8 文本输入输出。
4. 提交前检查中文字段是否出现 `鍦板悕` 这类乱码特征。

## 8. 可复现实验步骤

### 8.1 重建知识库与知识图谱
```bash
npm run mcp:build
```

### 8.2 本地检查图谱摘要
```bash
node -e "const fs=require('fs');const kg=JSON.parse(fs.readFileSync('server/mcp/knowledge_graph.json','utf8'));console.log(kg.metadata,kg.nodes.length,kg.links.length)"
```

### 8.3 MCP 调用验证（示意）
```js
// 使用 @modelcontextprotocol/sdk/client + stdio transport
// 调 tools/list，再调 tools/call(name='knowledge_query', arguments={mode:'metadata'})
```

## 9. 局限与后续建议

当前局限：
- `region:yunnan` 主要作为层级终点，`located_in` 以入边为主（语义上合理，但可按需要补充逆向显式边）。
- 邻接关系当前基于县级 `ST_Touches`，若用于大图推理可继续引入权重（边界长度、接触比例）。

后续建议：
1. 增加图谱版本回滚机制（`knowledge_graph.v*.json` 存档）。
2. 把构建过程纳入 CI（schema 校验 + 引用完整性 + 关系覆盖率阈值）。
3. 为 `knowledge_query` 增加分页和排序策略，避免大型结果截断语义。

---

## 10. 本次落地文件清单

- `ops/ai/build_knowledge_graph.js`（重写）
- `ops/ai/build_real_kg.js`（重写）
- `server/mcp/index.js`（增强）
- `server/mcp/knowledge_base.json`（重建）
- `server/mcp/knowledge_graph.json`（重建）
- `package.json`（新增 `mcp:build*` 脚本）
