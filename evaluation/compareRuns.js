#!/usr/bin/env node
import './runner/bootstrapEnv.js';
import path from 'path';
import fs from 'fs/promises';
import { PROJECT_ROOT } from './runner/bootstrapEnv.js';

const DEFAULT_REPORTS = [
  'evaluation/reports/llm_only_all_summary.json',
  'evaluation/reports/spatial_tools_all_summary.json',
  'evaluation/reports/knowledge_tools_all_summary.json',
  'evaluation/reports/full_agent_all_summary.json'
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

function resolveFile(input) {
  if (path.isAbsolute(input)) return input;
  return path.join(PROJECT_ROOT, input);
}

function runName(file) {
  return path.basename(file).replace(/_summary\.json$/, '');
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—';
}

function num(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function ms(value) {
  return Number.isFinite(value) ? (value / 1000).toFixed(2) : '—';
}

function mdCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function makeOverallTable(items) {
  const lines = [
    '| 实验组 | N | 工具准确率 | 参数准确率 | 运行成功率 | MRE | Hit@K | 趋势一致率 | 平均耗时(s) | 平均工具数 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  ];
  for (const item of items) {
    const s = item.summary.overall;
    lines.push(`| ${mdCell(item.name)} | ${s.n} | ${pct(s.tool_accuracy)} | ${pct(s.param_accuracy)} | ${pct(s.success_rate)} | ${num(s.mre, 6)} | ${pct(s.hit_k)} | ${pct(s.trend_consistency)} | ${ms(s.response_ms)} | ${num(s.tool_count, 2)} |`);
  }
  return lines.join('\n');
}

function makeCategoryTable(items) {
  const categories = [...new Set(items.flatMap((item) => Object.keys(item.summary.by_category || {})))].sort();
  const lines = [
    '| 实验组 | 类别 | N | 工具准确率 | 参数准确率 | 运行成功率 | MRE | Hit@K | 趋势一致率 | 平均耗时(s) |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  ];
  for (const item of items) {
    for (const category of categories) {
      const s = item.summary.by_category?.[category];
      if (!s) continue;
      lines.push(`| ${mdCell(item.name)} | ${mdCell(category)} | ${s.n} | ${pct(s.tool_accuracy)} | ${pct(s.param_accuracy)} | ${pct(s.success_rate)} | ${num(s.mre, 6)} | ${pct(s.hit_k)} | ${pct(s.trend_consistency)} | ${ms(s.response_ms)} |`);
    }
  }
  return lines.join('\n');
}

function makeDifficultyTable(items) {
  const difficulties = ['simple', 'composite', 'interpretive'];
  const lines = [
    '| 实验组 | 难度 | N | 工具准确率 | 参数准确率 | 运行成功率 | MRE | Hit@K | 趋势一致率 | 平均耗时(s) |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  ];
  for (const item of items) {
    for (const difficulty of difficulties) {
      const s = item.summary.by_difficulty?.[difficulty];
      if (!s) continue;
      lines.push(`| ${mdCell(item.name)} | ${difficulty} | ${s.n} | ${pct(s.tool_accuracy)} | ${pct(s.param_accuracy)} | ${pct(s.success_rate)} | ${num(s.mre, 6)} | ${pct(s.hit_k)} | ${pct(s.trend_consistency)} | ${ms(s.response_ms)} |`);
    }
  }
  return lines.join('\n');
}

function makeMarkdown(items) {
  return [
    '# GeoAI Agent 对照实验汇总表',
    '',
    '## 总体指标',
    '',
    makeOverallTable(items),
    '',
    '## 按任务类别统计',
    '',
    makeCategoryTable(items),
    '',
    '## 按难度层级统计',
    '',
    makeDifficultyTable(items),
    '',
    '> 指标说明：工具准确率统计期望工具是否被调用；参数准确率统计关键参数是否匹配；MRE用于数值型任务；Hit@K用于TopN/集合型任务；趋势一致率用于时序方向判断。'
  ].join('\n');
}

const cli = parseArgs(process.argv.slice(2));
const inputFiles = cli.inputs
  ? String(cli.inputs).split(',').map((item) => item.trim()).filter(Boolean)
  : DEFAULT_REPORTS;
const outputFile = cli.output
  ? resolveFile(cli.output)
  : path.join(PROJECT_ROOT, 'evaluation/reports/evaluation_comparison.md');

async function main() {
  const items = [];
  for (const input of inputFiles) {
    const file = resolveFile(input);
    const report = JSON.parse(await fs.readFile(file, 'utf8'));
    items.push({ name: runName(file), file, summary: report.summary });
  }
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${makeMarkdown(items)}\n`, 'utf8');
  console.log(`[eval-compare] reports=${items.length}`);
  console.log(`[eval-compare] output=${outputFile}`);
}

main().catch((err) => {
  console.error(`[eval-compare] fatal: ${err?.stack || err?.message || String(err)}`);
  process.exitCode = 1;
});
