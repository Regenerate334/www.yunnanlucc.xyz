# 基准结果说明

本目录用于存放需要人工整理或冻结版本的基准答案。

默认情况下，`runEvaluation.js` 会根据每个任务中的 `baseline.tool` 和 `baseline.args` 动态调用 MCP 工具生成基准结果。若论文实验需要固定一版结果，可将运行输出中的 `baseline.value` 和 `baseline.structuredContent` 另存到本目录，并在附录中说明基准版本。
