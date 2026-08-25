# GeoAI Agent 评价任务集

本目录按任务类型存放自然语言测试题，避免把实验样本杂糅在单个脚本中。

- `structure_query.json`：土地利用结构与单年面积查询。
- `trend_analysis.json`：长时序变化趋势分析。
- `transfer_analysis.json`：土地利用转移矩阵与主导转移方向。
- `spatial_hotspot.json`：空间热点、TopN、重心迁移和标准差椭圆。
- `risk_scoring.json`：生态风险代理指标与情景综合评分。
- `policy_explanation.json`：政策解释、知识增强与事实依据核验。

每个任务建议包含：

- `expected_tools`：期望调用工具，用于计算工具调用准确率。
- `expected_args`：期望参数，可只写关键参数，用于计算参数解析准确率。
- `baseline`：用于生成可复核基准结果的工具、参数和抽取口径。
- `manual_fact_units`：解释型任务的人工事实单元，可用于附录评分。
