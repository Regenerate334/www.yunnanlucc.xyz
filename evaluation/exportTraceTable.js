#!/usr/bin/env node
import './runner/bootstrapEnv.js';
import path from 'path';
import { PROJECT_ROOT } from './runner/bootstrapEnv.js';
import { readJsonl } from './runner/jsonl.js';
import { scoreRecord } from './metrics/scorers.js';
import fs from 'fs/promises';

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
  if (!input) throw new Error('请通过 --input=... 指定 run JSONL 文件');
  if (path.isAbsolute(input)) return input;
  return path.join(PROJECT_ROOT, input);
}

function asRelative(file) {
  return path.relative(PROJECT_ROOT, file).replace(/\\/g, '/');
}

function compactJson(value) {
  return JSON.stringify(value ?? null);
}

function escapeMarkdownCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function metricText(score) {
  const items = [];
  if (Number.isFinite(score.tool_accuracy)) items.push(`TA=${score.tool_accuracy}`);
  if (Number.isFinite(score.param_accuracy)) items.push(`PA=${score.param_accuracy}`);
  if (Number.isFinite(score.success_rate)) items.push(`SR=${score.success_rate}`);
  if (Number.isFinite(score.mre)) items.push(`MRE=${score.mre.toFixed(6)}`);
  if (Number.isFinite(score.hit_k)) items.push(`Hit@K=${score.hit_k.toFixed(3)}`);
  if (Number.isFinite(score.trend_consistency)) items.push(`TC=${score.trend_consistency}`);
  return items.join('; ');
}

function traceArgsText(trace = []) {
  return trace.map((item) => `${item.tool_name}${item.is_error ? '[ERR]' : ''}: ${compactJson(item.args)}`).join('<br>');
}

function baselineText(record) {
  if (!record.baseline) return '';
  return compactJson({
    tool: record.baseline.tool,
    args: record.baseline.args,
    value: record.baseline.value,
    is_error: record.baseline.is_error
  });
}

function makeMarkdown(records, inputFile) {
  const lines = [
    `# GeoAI Agent 逐题运行追踪表`,
    '',
    `- 输入文件：\`${asRelative(inputFile)}\``,
    `- 记录数：${records.length}`,
    '',
    '| 序号 | 任务ID | 类别 | 难度 | 自然语言问题 | 期望工具 | 实际工具链与参数 | 基准结果 | 指标 | 耗时(ms) |',
    '| ---: | --- | --- | --- | --- | --- | --- | --- | --- | ---: |'
  ];

  records.forEach((record, index) => {
    const score = scoreRecord(record);
    const cells = [
      index + 1,
      score.task_id,
      score.category,
      score.difficulty,
      record.task?.question || '',
      compactJson(score.expected_tools),
      traceArgsText(score.actual_trace),
      baselineText(record),
      metricText(score),
      score.response_ms ?? ''
    ];
    lines.push(`| ${cells.map(escapeMarkdownCell).join(' | ')} |`);
  });

  lines.push('');
  lines.push('> TA=工具调用准确率，PA=关键参数解析准确率，SR=运行成功率，MRE=相对误差，Hit@K=排序/集合命中率，TC=趋势方向一致率。');
  return lines.join('\n');
}

const cli = parseArgs(process.argv.slice(2));
const inputFile = resolveFile(cli.input);
const outputFile = cli.output
  ? (path.isAbsolute(cli.output) ? cli.output : path.join(PROJECT_ROOT, cli.output))
  : path.join(PROJECT_ROOT, 'evaluation/reports', `${path.basename(inputFile, '.jsonl')}_trace_table.md`);

async function main() {
  const records = await readJsonl(inputFile);
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${makeMarkdown(records, inputFile)}\n`, 'utf8');
  console.log(`[eval-trace] records=${records.length}`);
  console.log(`[eval-trace] output=${outputFile}`);
}

main().catch((err) => {
  console.error(`[eval-trace] fatal: ${err?.stack || err?.message || String(err)}`);
  process.exitCode = 1;
});
