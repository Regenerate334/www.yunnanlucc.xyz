# GeoAI Agent 定量评价实验

本目录用于支撑论文中“GeoAI Agent 分析能力评价”实验。设计原则是任务、运行、指标和结果分离，保证自然语言问题、期望工具、关键参数、基准结果和最终评分均可追溯。

## 目录结构

- `tasks/`：按任务类型存放自然语言问题与基准配置，并生成72题问题表。
- `runner/`：任务加载、MCP基准调用、Agent工具调用循环与原始记录写出。
- `metrics/`：参数解析、工具调用、结果一致性等指标计算。
- `output/runs/`：每次实验的逐题 JSONL 原始记录。
- `reports/`：汇总指标结果，可直接整理为论文表格。

## 正式实验流程

### 1. 生成72题正式题库和问题表

```bash
npm run eval:tasks
```

输出：

- `tasks/task_design_72.md`：72题自然语言问题表，可放入附录或实验材料。
- `tasks/*.json`：6类任务JSON，每类12题，每个难度层级4题。

### 0. 一键运行正式流程

如果希望从题库生成到结果汇总一次完成，可执行：

```bash
npm run eval:formal72
```

如果只想检查题库与MCP基准结果，不消耗LLM调用，可执行：

```bash
npm run eval:formal72 -- --skip-agent
```

### 2. 先跑MCP基准结果

```bash
npm run eval:agent -- --baseline-only --category=all --run=baseline_72
```

该步骤只调用MCP工具生成基准结果，不调用LLM，用于检查数据库、MCP和抽取口径是否正常。

### 3. 运行四组对照实验

```bash
npm run eval:agent -- --profile=llm_only --category=all --run=llm_only_72
npm run eval:agent -- --profile=spatial_tools --category=all --run=spatial_tools_72
npm run eval:agent -- --profile=knowledge_tools --category=all --run=knowledge_tools_72
npm run eval:agent -- --profile=full --category=all --run=full_agent_72
```

对照组含义：

- `llm_only`：普通大语言模型，不接入MCP工具。
- `spatial_tools`：仅接入CLCD、转移矩阵、空间统计等空间分析工具。
- `knowledge_tools`：仅接入知识库、知识图谱和政策文献索引工具。
- `full`：完整GeoAI Agent，接入空间工具与知识增强工具。

### 4. 汇总单组指标

```bash
npm run eval:summary -- --input=evaluation/output/runs/llm_only_72.jsonl
npm run eval:summary -- --input=evaluation/output/runs/spatial_tools_72.jsonl
npm run eval:summary -- --input=evaluation/output/runs/knowledge_tools_72.jsonl
npm run eval:summary -- --input=evaluation/output/runs/full_agent_72.jsonl
```

输出：

- `reports/<run_id>_summary.json`：总体、按任务类别、按难度层级和逐题评分。

### 5. 导出逐题工具与参数追踪表

```bash
npm run eval:trace -- --input=evaluation/output/runs/full_agent_72.jsonl
```

输出：

- `reports/full_agent_72_trace_table.md`：逐题展示自然语言问题、期望工具、实际工具链、实际参数、基准结果和指标值。

### 6. 生成四组对照汇总表

```bash
npm run eval:compare -- --inputs=evaluation/reports/llm_only_72_summary.json,evaluation/reports/spatial_tools_72_summary.json,evaluation/reports/knowledge_tools_72_summary.json,evaluation/reports/full_agent_72_summary.json --output=evaluation/reports/evaluation_comparison_72.md
```

输出：

- `reports/evaluation_comparison_72.md`：总体、按任务类别、按难度层级的对照表，可直接整理进论文。

### 7. 生成增强评价材料和论文表格

以下步骤不重跑模型，只基于已有 `*_72.jsonl` 结果进行严格再评分、回答质量评价和论文表格生成：

```bash
npm run eval:policy-facts
npm run eval:summary -- --input=evaluation/output/runs/llm_only_72.jsonl --output=evaluation/reports/llm_only_72_summary.json
npm run eval:summary -- --input=evaluation/output/runs/spatial_tools_72.jsonl --output=evaluation/reports/spatial_tools_72_summary.json
npm run eval:summary -- --input=evaluation/output/runs/knowledge_tools_72.jsonl --output=evaluation/reports/knowledge_tools_72_summary.json
npm run eval:summary -- --input=evaluation/output/runs/full_agent_72.jsonl --output=evaluation/reports/full_agent_72_summary.json
npm run eval:answer-quality -- --input=evaluation/output/runs/full_agent_72.jsonl
npm run eval:paper-tables
```

输出：

- `baselines/policy_fact_base.json`：由项目内政策/规划文献索引库整理的事实基准，不使用实时网络检索。
- `reports/full_agent_72_answer_quality.json` 和 `.md`：回答质量逐题证据表。
- `reports/paper_tables_7_8_9.md`：论文表7、表8、表9增强评价结果。

## 指标口径

- 工具调用准确率（Acc_t / tool_recall）：期望工具是否出现在Agent实际工具调用链中，是召回导向指标。
- Tool-F1：同时考虑期望工具命中和冗余工具调用，实际调用过多会降低得分。
- 参数解析准确率：期望关键参数是否与Agent实际调用参数一致；`param_accuracy` 默认采用关键词数组顺序无关的宽松匹配，`param_accuracy_strict` 保留逐元素严格匹配结果。
- 严格运行成功率（SR_strict）：全部任务进入分母，`agent=null`、请求失败、工具调用错误均计为失败。
- 有效响应成功率（valid_success_rate）：仅对存在Agent响应的记录计算，可用于审计但不建议作为论文主表SR。
- 回答可用率（answer_available_rate）：是否返回最终自然语言回答，不代表内容正确。
- 数值相对误差（MRE）：用于面积、风险评分、重心迁移距离、SDE面积等数值型任务。
- Hit@K：用于TopN热点、主导转移方向、优势地类等排序/集合型任务。
- 趋势一致率：用于时序变化任务，判断增减方向是否与MCP基准结果一致。
- Cov/Con：基于项目内官方政策事实库与Codex/GPT辅助标注计算的事实覆盖率和事实矛盾率，不使用实时网络检索。
- AQ：回答质量得分，综合回答是否存在、是否引用工具证据、是否引用政策来源、是否覆盖任务事实单元以及是否存在过度推断。

## 快速调试命令

仅生成MCP/后端基准结果：

```bash
npm run eval:agent -- --baseline-only --category=all
```

运行完整 GeoAI Agent 评价：

```bash
npm run eval:agent -- --profile=full --category=all
```

运行某一类任务：

```bash
npm run eval:agent -- --profile=full --category=spatial_hotspot
```

汇总某次运行结果：

```bash
npm run eval:summary -- --input=evaluation/output/runs/<run_id>.jsonl
```

## 对照组建议

- `--profile=llm_only`：普通大语言模型，不接入MCP工具。
- `--profile=spatial_tools`：仅接入空间分析工具。
- `--profile=knowledge_tools`：仅接入知识/政策工具。
- `--profile=full`：完整 GeoAI Agent。
