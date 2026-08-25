# GeoAI Agent 回答质量增强评价

- 输入文件：`evaluation/output/runs/full_agent_72.jsonl`
- 政策事实库：`evaluation/baselines/policy_fact_base.json`
- 评价说明：回答质量评价基于项目内MCP结构化结果、任务manual_fact_units、本地政策事实库和Codex/GPT辅助标注；不调用项目LLM，不使用实时网络检索。

## 总体

| N | AQ | 证据支撑率 | 来源引用率 | Cov | Con | 过度推断率 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 72 | 56.5% | 43.1% | 41.0% | 91.7% | 0.0% | 43.7% |

## 逐题证据表

| 任务ID | 类别 | 难度 | AQ | 证据 | 来源 | Cov | Con | 过度推断 | 备注 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| policy-simple-001 | policy_explanation | simple | 71.4% | 0.0% | 100.0% | 100.0% | 0.0% | 0.0% | 回答引用云南省国土空间规划发布入口，并说明具体约束指标需以正式文本为准，覆盖参考事实。 |
| policy-simple-002 | policy_explanation | simple | 57.1% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 回答覆盖三条控制线、建设用地增量控制、永久基本农田特殊保护、非农化约束和新型城镇化背景。 |
| policy-simple-003 | policy_explanation | simple | 71.4% | 0.0% | 100.0% | 100.0% | 0.0% | 0.0% | 回答覆盖生态保护红线若干意见、三条控制线、生态文明制度框架、永久基本农田衔接和退耕还林政策背景。 |
| policy-simple-004 | policy_explanation | simple | 71.4% | 0.0% | 100.0% | 100.0% | 0.0% | 0.0% | 回答覆盖非农化、非粮化、占补平衡、三位一体保护和三条控制线约束。 |
| policy-composite-001 | policy_explanation | composite | 57.1% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 回答明确检索云南省国土空间规划发布信息，并将其作为省级空间管控框架依据。 |
| policy-composite-002 | policy_explanation | composite | 71.4% | 0.0% | 100.0% | 100.0% | 0.0% | 0.0% | 回答引用昆明市国土空间总体规划批复入口，并说明城镇开发边界、永久基本农田和生态保护红线约束。 |
| policy-composite-003 | policy_explanation | composite | 71.4% | 0.0% | 100.0% | 100.0% | 0.0% | 0.0% | 回答覆盖2019年国土空间规划体系、三条控制线、用途管制实施、非农化约束和永久基本农田保护。 |
| policy-composite-004 | policy_explanation | composite | 71.4% | 0.0% | 100.0% | 100.0% | 0.0% | 0.0% | 回答覆盖2020年以来非农化、非粮化、三条控制线、占补平衡升级和建设用地增量控制。 |
| policy-interpretive-001 | policy_explanation | interpretive | 57.1% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 回答将建设用地热点与云南省国土空间规划管控关联，并引用省级规划发布信息作为依据。 |
| policy-interpretive-002 | policy_explanation | interpretive | 71.4% | 0.0% | 100.0% | 100.0% | 0.0% | 0.0% | 回答覆盖耕转建、永久基本农田、非农化、占补平衡、建设用地扩张与城镇化背景之间的关系。 |
| policy-interpretive-003 | policy_explanation | interpretive | 50.0% | 0.0% | 50.0% | 0.0% | 0.0% | 0.0% | 回答主要引用国家层面的三条控制线、生态红线、永久基本农田和监测指标，未实质覆盖参考事实中的云南省级国土空间规划发布入口。 |
| policy-interpretive-004 | policy_explanation | interpretive | 71.4% | 0.0% | 100.0% | 100.0% | 0.0% | 0.0% | 回答明确将系统能力与云南省国土空间规划监测预警要求关联，并在结尾给出云南省自然资源厅规划发布信息来源。 |
| risk-simple-001 | risk_scoring | simple | 87.5% | 100.0% | 50.0% | — | — | 0.0% |  |
| risk-simple-002 | risk_scoring | simple | 62.5% | 100.0% | 50.0% | — | — | 100.0% |  |
| risk-simple-003 | risk_scoring | simple | 87.5% | 100.0% | 50.0% | — | — | 0.0% |  |
| risk-simple-004 | risk_scoring | simple | 62.5% | 100.0% | 50.0% | — | — | 100.0% |  |
| risk-composite-001 | risk_scoring | composite | 87.5% | 100.0% | 50.0% | — | — | 0.0% |  |
| risk-composite-002 | risk_scoring | composite | 87.5% | 100.0% | 50.0% | — | — | 0.0% |  |
| risk-composite-003 | risk_scoring | composite | 87.5% | 100.0% | 50.0% | — | — | 0.0% |  |
| risk-composite-004 | risk_scoring | composite | 50.0% | 100.0% | 0.0% | — | — | 100.0% |  |
| risk-interpretive-001 | risk_scoring | interpretive | 70.0% | 100.0% | 50.0% | — | — | 0.0% |  |
| risk-interpretive-002 | risk_scoring | interpretive | 50.0% | 100.0% | 50.0% | — | — | 100.0% |  |
| risk-interpretive-003 | risk_scoring | interpretive | 70.0% | 100.0% | 50.0% | — | — | 0.0% |  |
| risk-interpretive-004 | risk_scoring | interpretive | 70.0% | 100.0% | 50.0% | — | — | 0.0% |  |
| spatial-simple-001 | spatial_hotspot | simple | 75.0% | 100.0% | 0.0% | — | — | 0.0% |  |
| spatial-simple-002 | spatial_hotspot | simple | 75.0% | 100.0% | 0.0% | — | — | 0.0% |  |
| spatial-simple-003 | spatial_hotspot | simple | 50.0% | 100.0% | 0.0% | — | — | 100.0% |  |
| spatial-simple-004 | spatial_hotspot | simple | 75.0% | 100.0% | 0.0% | — | — | 0.0% |  |
| spatial-composite-001 | spatial_hotspot | composite | 62.5% | 100.0% | 50.0% | — | — | 100.0% |  |
| spatial-composite-002 | spatial_hotspot | composite | 87.5% | 100.0% | 50.0% | — | — | 0.0% |  |
| spatial-composite-003 | spatial_hotspot | composite | 75.0% | 100.0% | 0.0% | — | — | 0.0% |  |
| spatial-composite-004 | spatial_hotspot | composite | 87.5% | 100.0% | 50.0% | — | — | 0.0% |  |
| spatial-interpretive-001 | spatial_hotspot | interpretive | 50.0% | 100.0% | 50.0% | — | — | 100.0% |  |
| spatial-interpretive-002 | spatial_hotspot | interpretive | 70.0% | 100.0% | 50.0% | — | — | 0.0% |  |
| spatial-interpretive-003 | spatial_hotspot | interpretive | 50.0% | 100.0% | 50.0% | — | — | 100.0% |  |
| spatial-interpretive-004 | spatial_hotspot | interpretive | 0.0% | 0.0% | 0.0% | — | — | — |  |
| structure-simple-001 | structure_query | simple | 75.0% | 100.0% | 0.0% | — | — | 0.0% |  |
| structure-simple-002 | structure_query | simple | 75.0% | 100.0% | 0.0% | — | — | 0.0% |  |
| structure-simple-003 | structure_query | simple | 50.0% | 100.0% | 0.0% | — | — | 100.0% |  |
| structure-simple-004 | structure_query | simple | 75.0% | 100.0% | 0.0% | — | — | 0.0% |  |
| structure-composite-001 | structure_query | composite | 50.0% | 100.0% | 0.0% | — | — | 100.0% |  |
| structure-composite-002 | structure_query | composite | 75.0% | 100.0% | 0.0% | — | — | 0.0% |  |
| structure-composite-003 | structure_query | composite | 50.0% | 100.0% | 0.0% | — | — | 100.0% |  |
| structure-composite-004 | structure_query | composite | 75.0% | 100.0% | 0.0% | — | — | 0.0% |  |
| structure-interpretive-001 | structure_query | interpretive | 30.0% | 0.0% | 50.0% | — | — | 100.0% |  |
| structure-interpretive-002 | structure_query | interpretive | 20.0% | 0.0% | 0.0% | — | — | 100.0% |  |
| structure-interpretive-003 | structure_query | interpretive | 20.0% | 0.0% | 0.0% | — | — | 100.0% |  |
| structure-interpretive-004 | structure_query | interpretive | 20.0% | 0.0% | 0.0% | — | — | 100.0% |  |
| transfer-simple-001 | transfer_analysis | simple | 62.5% | 0.0% | 50.0% | — | — | 0.0% |  |
| transfer-simple-002 | transfer_analysis | simple | 37.5% | 0.0% | 50.0% | — | — | 100.0% |  |
| transfer-simple-003 | transfer_analysis | simple | 62.5% | 0.0% | 50.0% | — | — | 0.0% |  |
| transfer-simple-004 | transfer_analysis | simple | 62.5% | 0.0% | 50.0% | — | — | 0.0% |  |
| transfer-composite-001 | transfer_analysis | composite | 37.5% | 0.0% | 50.0% | — | — | 100.0% |  |
| transfer-composite-002 | transfer_analysis | composite | 37.5% | 0.0% | 50.0% | — | — | 100.0% |  |
| transfer-composite-003 | transfer_analysis | composite | 37.5% | 0.0% | 50.0% | — | — | 100.0% |  |
| transfer-composite-004 | transfer_analysis | composite | 37.5% | 0.0% | 50.0% | — | — | 100.0% |  |
| transfer-interpretive-001 | transfer_analysis | interpretive | 30.0% | 0.0% | 50.0% | — | — | 100.0% |  |
| transfer-interpretive-002 | transfer_analysis | interpretive | 50.0% | 0.0% | 50.0% | — | — | 0.0% |  |
| transfer-interpretive-003 | transfer_analysis | interpretive | 30.0% | 0.0% | 50.0% | — | — | 100.0% |  |
| transfer-interpretive-004 | transfer_analysis | interpretive | 30.0% | 0.0% | 50.0% | — | — | 100.0% |  |
| trend-simple-001 | trend_analysis | simple | 25.0% | 0.0% | 0.0% | — | — | 100.0% |  |
| trend-simple-002 | trend_analysis | simple | 50.0% | 0.0% | 0.0% | — | — | 0.0% |  |
| trend-simple-003 | trend_analysis | simple | 50.0% | 0.0% | 0.0% | — | — | 0.0% |  |
| trend-simple-004 | trend_analysis | simple | 62.5% | 0.0% | 50.0% | — | — | 0.0% |  |
| trend-composite-001 | trend_analysis | composite | 25.0% | 0.0% | 0.0% | — | — | 100.0% |  |
| trend-composite-002 | trend_analysis | composite | 62.5% | 0.0% | 50.0% | — | — | 0.0% |  |
| trend-composite-003 | trend_analysis | composite | 50.0% | 0.0% | 0.0% | — | — | 0.0% |  |
| trend-composite-004 | trend_analysis | composite | 50.0% | 0.0% | 0.0% | — | — | 0.0% |  |
| trend-interpretive-001 | trend_analysis | interpretive | 30.0% | 0.0% | 50.0% | — | — | 100.0% |  |
| trend-interpretive-002 | trend_analysis | interpretive | 30.0% | 0.0% | 50.0% | — | — | 100.0% |  |
| trend-interpretive-003 | trend_analysis | interpretive | 50.0% | 0.0% | 50.0% | — | — | 0.0% |  |
| trend-interpretive-004 | trend_analysis | interpretive | 30.0% | 0.0% | 50.0% | — | — | 100.0% |  |
