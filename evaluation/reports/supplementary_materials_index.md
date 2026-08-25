# GeoAI Agent 评价实验补充材料索引

本文档用于汇总 GeoAI Agent 分析能力评价实验的过程文件、任务集、原始记录、指标报告和论文表格，可作为论文补充材料的目录文件。

## 1. 评价任务集

正式评价任务集共 72 个自然语言问题，采用 6 类任务、3 个难度层级、每层级 4 题的均衡设计。

| 文件 | 内容说明 |
|---|---|
| [task_design_72.md](../tasks/task_design_72.md) | 72 个具体自然语言问题、任务类别、难度层级、期望工具、关键参数和基准抽取口径 |
| [structure_query.json](../tasks/structure_query.json) | 土地利用结构查询任务定义 |
| [trend_analysis.json](../tasks/trend_analysis.json) | 时序变化趋势查询任务定义 |
| [transfer_analysis.json](../tasks/transfer_analysis.json) | 土地利用转移分析任务定义 |
| [spatial_hotspot.json](../tasks/spatial_hotspot.json) | 空间分异与热点识别任务定义 |
| [risk_scoring.json](../tasks/risk_scoring.json) | 生态风险综合识别任务定义 |
| [policy_explanation.json](../tasks/policy_explanation.json) | 政策解释与综合判断任务定义 |

## 2. 实验流程与复现命令

实验采用相同的 72 题任务集，对普通 LLM、仅接入分析工具、仅接入知识工具和完整 GeoAI Agent 四组进行对照评价。

```bash
npm run eval:tasks
npm run eval:formal72
npm run eval:policy-facts
npm run eval:answer-quality -- --input=evaluation/output/runs/full_agent_72.jsonl
npm run eval:paper-tables
```

| 文件 | 内容说明 |
|---|---|
| [README.md](../README.md) | 评价流水线、命令、对照组和指标口径说明 |
| [latest_run.json](latest_run.json) | 最近一次正式运行记录，包括任务数、完成数和失败数 |

## 3. 原始逐题运行记录

以下 JSONL 文件为各实验组逐题原始记录，包含任务信息、基准结果、Agent 最终回答、工具调用轨迹、参数和错误信息。

| 实验组 | 原始记录 |
|---|---|
| MCP 基准 | [baseline_72.jsonl](../output/runs/baseline_72.jsonl) |
| 普通 LLM | [llm_only_72.jsonl](../output/runs/llm_only_72.jsonl) |
| 仅接入分析工具 | [spatial_tools_72.jsonl](../output/runs/spatial_tools_72.jsonl) |
| 仅接入知识工具 | [knowledge_tools_72.jsonl](../output/runs/knowledge_tools_72.jsonl) |
| 完整 GeoAI Agent | [full_agent_72.jsonl](../output/runs/full_agent_72.jsonl) |

## 4. 指标汇总报告

以下文件为四组对照实验的自动汇总结果，包含总体指标、按任务类型统计、按难度层级统计和逐题评分。

| 实验组 | 汇总报告 |
|---|---|
| MCP 基准 | [baseline_72_summary.json](baseline_72_summary.json) |
| 普通 LLM | [llm_only_72_summary.json](llm_only_72_summary.json) |
| 仅接入分析工具 | [spatial_tools_72_summary.json](spatial_tools_72_summary.json) |
| 仅接入知识工具 | [knowledge_tools_72_summary.json](knowledge_tools_72_summary.json) |
| 完整 GeoAI Agent | [full_agent_72_summary.json](full_agent_72_summary.json) |
| 四组对照汇总表 | [evaluation_comparison_72.md](evaluation_comparison_72.md) |

## 5. 工具调用与参数追踪表

以下 Markdown 文件按任务逐条展示自然语言问题、期望工具、实际工具调用链、实际参数、基准结果和评分结果，可用于审计工具调用过程。

| 实验组 | 追踪表 |
|---|---|
| 普通 LLM | [llm_only_72_trace_table.md](llm_only_72_trace_table.md) |
| 仅接入分析工具 | [spatial_tools_72_trace_table.md](spatial_tools_72_trace_table.md) |
| 仅接入知识工具 | [knowledge_tools_72_trace_table.md](knowledge_tools_72_trace_table.md) |
| 完整 GeoAI Agent | [full_agent_72_trace_table.md](full_agent_72_trace_table.md) |

## 6. 政策事实与回答质量评价

政策解释与回答质量评价基于项目内政策事实库、任务事实单元、MCP 工具结构化结果和 Codex/GPT 辅助标注，不使用实时网络检索。

| 文件 | 内容说明 |
|---|---|
| [policy_fact_base.json](../baselines/policy_fact_base.json) | 由项目内政策/规划文献索引库整理形成的政策事实基准 |
| [full_agent_72_policy_fact_annotations_codex.json](full_agent_72_policy_fact_annotations_codex.json) | Codex/GPT 对政策解释任务的事实覆盖与冲突辅助标注 |
| [full_agent_72_policy_fact_summary_codex.md](full_agent_72_policy_fact_summary_codex.md) | 政策事实覆盖率 Cov 和事实矛盾率 Con 汇总 |
| [full_agent_72_answer_quality.md](full_agent_72_answer_quality.md) | 回答质量 AQ、证据支撑率、来源引用率、过度推断率和逐题证据表 |

## 7. 论文表格结果

| 文件 | 内容说明 |
|---|---|
| [paper_tables_7_8_9.md](paper_tables_7_8_9.md) | 论文表 7、表 8、表 9 的增强评价结果 |

## 8. 指标口径说明

- `Acc_t`：期望工具召回率，表示任务期望工具是否被 Agent 调用。
- `Tool-F1`：同时考虑期望工具命中和冗余工具调用，用于惩罚过度工具调用。
- `Acc_p`：关键参数解析准确率，其中关键词数组采用顺序无关匹配。
- `SR`：严格任务成功率，全部任务进入分母；请求失败、`agent=null` 和工具错误均计为失败。
- `MRE`：数值型结果平均相对误差，仅对面积、评分、空间统计量等数值任务适用。
- `Hit@K`：排序或集合型结果的 Top-K 命中率。
- `TC`：趋势一致率，用于时序趋势类任务。
- `Cov/Con`：基于项目内政策事实库与辅助标注得到的事实覆盖率和事实矛盾率。
- `AQ`：回答质量得分，综合回答是否存在、是否引用工具证据、是否引用政策来源、事实覆盖和过度推断检查。

## 9. 方法学边界

本实验主要评价 GeoAI Agent 是否能够将自然语言问题正确转化为空间分析任务，并调用相应 MCP 工具形成可追溯结果。MRE、Hit@K 和 TC 的基准来自预设 MCP 工具调用结果，主要用于检验 Agent 是否复现既定分析流程，而非对遥感分类结果或空间统计工具本身进行独立外部验证。政策事实评价基于项目内整理的政策事实库和辅助标注，适合作为解释可信度的过程性评价依据。
