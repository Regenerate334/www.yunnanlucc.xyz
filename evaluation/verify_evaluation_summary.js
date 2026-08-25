import fs from 'fs';
import path from 'path';

const summaryPath = path.resolve('evaluation/reports/full_agent_72_summary.json');

if (fs.existsSync(summaryPath)) {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    console.log("========== 完整评估报告数据多尺度校核 ==========");
    
    // 1. 校核消融对照组总体数据 (完整Agent)
    console.log("\n--- 表6 (总体指标) 真实计算值:");
    console.log(`  Acc_t: ${(summary.summary.overall.tool_accuracy * 100).toFixed(1)}%`);
    console.log(`  Tool-F1: ${(summary.summary.overall.tool_f1 * 100).toFixed(1)}%`);
    console.log(`  Acc_p: ${(summary.summary.overall.param_accuracy * 100).toFixed(1)}%`);
    console.log(`  SR_strict: ${(summary.summary.overall.strict_success * 100).toFixed(1)}%`);
    console.log(`  MRE: ${summary.summary.overall.mre}`);
    console.log(`  Hit@K: ${(summary.summary.overall.hit_k * 100).toFixed(1)}%`);
    console.log(`  TC: ${(summary.summary.overall.trend_consistency * 100).toFixed(1)}%`);
    console.log(`  T_avg: ${(summary.summary.overall.response_ms / 1000).toFixed(2)}s`);
    
    // 2. 校核难度层级数据 (表8)
    const byDifficulty = summary.summary.by_difficulty;
    if (byDifficulty) {
        console.log("\n--- 表8 (难度层级) 真实计算值:");
        for (const diff of Object.keys(byDifficulty)) {
            const d = byDifficulty[diff];
            console.log(`  难度 [${diff}]:`);
            console.log(`    Acc_t: ${(d.tool_accuracy * 100).toFixed(1)}%`);
            console.log(`    Tool-F1: ${(d.tool_f1 * 100).toFixed(1)}%`);
            console.log(`    Acc_p: ${(d.param_accuracy * 100).toFixed(1)}%`);
            console.log(`    SR_strict (严格成功率): ${(d.strict_success * 100).toFixed(1)}%`);
            console.log(`    AQ: ${(d.answer_quality !== undefined ? d.answer_quality * 100 : 0).toFixed(1)}%`);
            console.log(`    T_avg: ${(d.response_ms / 1000).toFixed(2)}s`);
        }
    } else {
        console.log("未在汇总 JSON 中找到 by_difficulty 分类。");
    }

} else {
    console.log("找不到评估报告文件:", summaryPath);
}
