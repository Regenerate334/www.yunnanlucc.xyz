# utils 目录说明（后端）

本目录用于存放后端的“通用能力模块”。为了便于长期维护，目录按职责分层归档，同时保留少量 **兼容层（re-export）** 文件，避免因重构导致大量 `import` 路径断裂。

## 目录结构（建议阅读顺序）

- `ai/`
  - AI 能力相关资产（技能、语料、核心模块）。详见 `server/utils/ai/README.md`。
- `tools/`
  - 面向大模型可调用的工具实现（CLCD/空间统计/政策索引/知识图谱等）。建议从 `analysis/` 与 `knowledge/` 子目录理解。 
- `dataSources/`
  - 数据源插件（作为 Registry 的可扩展入口）。
- `indices/`
  - 指标/矩阵等纯计算模块（不直接依赖 HTTP 层）。

## 根目录文件说明

以下文件属于“全局基础能力”，被多个模块引用：

- `dataSourceRegistry.js`：工具/数据源注册中心（会打印 “已注册数据工具” 日志）
- `dataRouter.js`：AI 数据聚合路由（将用户意图映射到数据库查询/上下文片段）
- `period_encoder.js`：时段编码与解析工具
- `cryptoHelper.js`：RSA/加解密辅助
- `schemaDiscovery.js`：Schema 探测工具

AI 核心实现已统一归档到 `server/utils/ai/core/`，请直接引用该目录下的模块，避免在根目录保留“同名转发文件”造成维护混淆。

## 编码约束

项目涉及中文内容时，所有文本与 JSON 必须使用 UTF-8 编码（遵循仓库 `AGENTS.md`）。
