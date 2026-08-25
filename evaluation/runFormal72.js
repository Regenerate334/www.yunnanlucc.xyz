#!/usr/bin/env node
import { spawn } from 'child_process';
import { PROJECT_ROOT } from './runner/bootstrapEnv.js';

const RUNS = [
  { profile: 'llm_only', run: 'llm_only_72' },
  { profile: 'spatial_tools', run: 'spatial_tools_72' },
  { profile: 'knowledge_tools', run: 'knowledge_tools_72' },
  { profile: 'full', run: 'full_agent_72' }
];

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const [key, rawValue] = item.slice(2).split('=');
    args[key] = rawValue === undefined ? true : rawValue;
  }
  return args;
}

function runNodeStep(label, script, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n[formal72] ${label}`);
    console.log(`[formal72] node ${script} ${args.join(' ')}`.trim());
    const child = spawn(process.execPath, [script, ...args], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      shell: false
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const skipAgent = cli['skip-agent'] === true || String(cli['skip-agent']).toLowerCase() === 'true';
  const onlyBaseline = cli['baseline-only'] === true || String(cli['baseline-only']).toLowerCase() === 'true';
  const model = cli.model ? [`--model=${cli.model}`] : [];

  await runNodeStep('生成72题正式题库与问题表', './evaluation/tasks/buildTaskSet.js');

  await runNodeStep('运行72题MCP基准检查', './evaluation/runEvaluation.js', [
    '--baseline-only',
    '--category=all',
    '--run=baseline_72',
    ...model
  ]);

  await runNodeStep('汇总72题MCP基准检查', './evaluation/summarizeRun.js', [
    '--input=evaluation/output/runs/baseline_72.jsonl',
    '--output=evaluation/reports/baseline_72_summary.json'
  ]);

  if (onlyBaseline || skipAgent) {
    console.log('\n[formal72] 已按参数跳过LLM对照实验。');
    return;
  }

  for (const item of RUNS) {
    await runNodeStep(`运行 ${item.run}`, './evaluation/runEvaluation.js', [
      `--profile=${item.profile}`,
      '--category=all',
      `--run=${item.run}`,
      ...model
    ]);

    await runNodeStep(`汇总 ${item.run}`, './evaluation/summarizeRun.js', [
      `--input=evaluation/output/runs/${item.run}.jsonl`,
      `--output=evaluation/reports/${item.run}_summary.json`
    ]);

    await runNodeStep(`导出 ${item.run} 逐题追踪表`, './evaluation/exportTraceTable.js', [
      `--input=evaluation/output/runs/${item.run}.jsonl`,
      `--output=evaluation/reports/${item.run}_trace_table.md`
    ]);
  }

  await runNodeStep('生成四组对照汇总表', './evaluation/compareRuns.js', [
    '--inputs=evaluation/reports/llm_only_72_summary.json,evaluation/reports/spatial_tools_72_summary.json,evaluation/reports/knowledge_tools_72_summary.json,evaluation/reports/full_agent_72_summary.json',
    '--output=evaluation/reports/evaluation_comparison_72.md'
  ]);

  console.log('\n[formal72] 正式评价实验流程完成。');
  console.log(`[formal72] 问题表: ${PROJECT_ROOT}/evaluation/tasks/task_design_72.md`);
  console.log(`[formal72] 汇总表: ${PROJECT_ROOT}/evaluation/reports/evaluation_comparison_72.md`);
}

main().catch((err) => {
  console.error(`[formal72] fatal: ${err?.stack || err?.message || String(err)}`);
  process.exitCode = 1;
});
