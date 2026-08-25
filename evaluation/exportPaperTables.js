#!/usr/bin/env node
import './runner/bootstrapEnv.js';
import fs from 'fs/promises';
import path from 'path';
import { PROJECT_ROOT } from './runner/bootstrapEnv.js';

const DEFAULT_INPUTS = [
  'evaluation/reports/llm_only_72_summary.json',
  'evaluation/reports/spatial_tools_72_summary.json',
  'evaluation/reports/knowledge_tools_72_summary.json',
  'evaluation/reports/full_agent_72_summary.json'
];
const DEFAULT_AQ = 'evaluation/reports/full_agent_72_answer_quality.json';
const DEFAULT_OUTPUT = 'evaluation/reports/paper_tables_7_8_9.md';

const RUN_LABELS = {
  llm_only_72: '普通LLM',
  spatial_tools_72: '仅接入分析工具',
  knowledge_tools_72: '仅接入知识工具',
  full_agent_72: '完整GeoAI Agent'
};

const CATEGORY_LABELS = {
  policy_explanation: '政策解释与综合判断',
  risk_scoring: '生态风险综合识别',
  spatial_hotspot: '空间分异与热点识别',
  structure_query: '土地利用结构查询',
  transfer_analysis: '土地利用转移分析',
  trend_analysis: '时序变化趋势查询'
};

const DIFFICULTY_LABELS = {
  simple: '简单任务',
  composite: '复合任务',
  interpretive: '综合解释任务'
};

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
  return path.isAbsolute(input) ? input : path.join(PROJECT_ROOT, input);
}

function runName(file) {
  return path.basename(file).replace(/_summary\.json$/, '');
}

function pct(value) {
  return Number.isFinite(value) ? (value * 100).toFixed(1) : '—';
}

function ms(value) {
  return Number.isFinite(value) ? (value / 1000).toFixed(2) : '—';
}

function valueWithN(value, n, { percent = true, digits = 1 } = {}) {
  if (!Number.isFinite(value)) return '—';
  const formatted = percent ? `${(value * 100).toFixed(digits)}` : value.toFixed(digits);
  return Number.isFinite(n) && n > 0 ? `${formatted}(n=${n})` : formatted;
}

function num(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function mdCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function getAq(aqReport, scope, key) {
  if (!aqReport) return null;
  if (scope === 'overall') return aqReport.summary?.overall?.[key] ?? null;
  return aqReport.summary?.[scope]?.[key] ?? null;
}

function makeOverallTable(items, aqReport) {
  const lines = [
    '表7 GeoAI Agent 消融实验总体评价结果',
    '',
    '| 实验组 | Acc_t(%) | Tool-F1(%) | Acc_p(%) | SR_strict(%) | MRE | Hit@K(%) | TC(%) | Cov(%) | Con(%) | AQ(%) | T_avg(s) | 平均工具数 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  ];

  for (const item of items) {
    const s = item.report.summary.overall;
    const aq = item.name === 'full_agent_72' ? getAq(aqReport, 'overall', 'answer_quality') : null;
    const cov = item.name === 'full_agent_72' ? getAq(aqReport, 'overall', 'fact_coverage') : s.fact_coverage;
    const con = item.name === 'full_agent_72' ? getAq(aqReport, 'overall', 'contradiction_rate') : s.contradiction_rate;
    lines.push(`| ${mdCell(RUN_LABELS[item.name] || item.name)} | ${pct(s.tool_recall ?? s.tool_accuracy)} | ${pct(s.tool_f1)} | ${pct(s.param_accuracy_relaxed ?? s.param_accuracy)} | ${pct(s.strict_success ?? s.success_rate)} | ${valueWithN(s.mre, s.mre_n, { percent: false, digits: 1 })} | ${valueWithN(s.hit_k, s.hit_k_n)} | ${valueWithN(s.trend_consistency, s.trend_consistency_n)} | ${pct(cov)} | ${pct(con)} | ${pct(aq)} | ${ms(s.response_ms)} | ${num(s.tool_count, 1)} |`);
  }
  return lines.join('\n');
}

function makeCategoryTable(fullReport, aqReport) {
  const order = ['policy_explanation', 'risk_scoring', 'spatial_hotspot', 'structure_query', 'transfer_analysis', 'trend_analysis'];
  const lines = [
    '表8 完整GeoAI Agent 按任务类型评价结果',
    '',
    '| 任务类型 | Acc_t(%) | Tool-F1(%) | Acc_p(%) | SR_strict(%) | MRE | Hit@K(%) | TC(%) | Cov(%) | Con(%) | AQ(%) | T_avg(s) |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  ];

  for (const category of order) {
    const s = fullReport.summary.by_category?.[category];
    if (!s) continue;
    const aq = aqReport?.summary?.by_category?.[category] || {};
    const cov = aq.fact_coverage ?? s.fact_coverage;
    const con = aq.contradiction_rate ?? s.contradiction_rate;
    lines.push(`| ${mdCell(CATEGORY_LABELS[category] || category)} | ${pct(s.tool_recall ?? s.tool_accuracy)} | ${pct(s.tool_f1)} | ${pct(s.param_accuracy_relaxed ?? s.param_accuracy)} | ${pct(s.strict_success ?? s.success_rate)} | ${valueWithN(s.mre, s.mre_n, { percent: false, digits: 1 })} | ${valueWithN(s.hit_k, s.hit_k_n)} | ${valueWithN(s.trend_consistency, s.trend_consistency_n)} | ${pct(cov)} | ${pct(con)} | ${pct(aq.answer_quality)} | ${ms(s.response_ms)} |`);
  }
  return lines.join('\n');
}

function makeDifficultyTable(fullReport, aqReport) {
  const order = ['simple', 'composite', 'interpretive'];
  const lines = [
    '表9 完整GeoAI Agent 按难度层级评价结果',
    '',
    '| 难度层级 | Acc_t(%) | Tool-F1(%) | Acc_p(%) | SR_strict(%) | MRE | Hit@K(%) | TC(%) | Cov(%) | Con(%) | AQ(%) | T_avg(s) |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  ];

  for (const difficulty of order) {
    const s = fullReport.summary.by_difficulty?.[difficulty];
    if (!s) continue;
    const aq = aqReport?.summary?.by_difficulty?.[difficulty] || {};
    const cov = aq.fact_coverage ?? s.fact_coverage;
    const con = aq.contradiction_rate ?? s.contradiction_rate;
    lines.push(`| ${mdCell(DIFFICULTY_LABELS[difficulty] || difficulty)} | ${pct(s.tool_recall ?? s.tool_accuracy)} | ${pct(s.tool_f1)} | ${pct(s.param_accuracy_relaxed ?? s.param_accuracy)} | ${pct(s.strict_success ?? s.success_rate)} | ${valueWithN(s.mre, s.mre_n, { percent: false, digits: 1 })} | ${valueWithN(s.hit_k, s.hit_k_n)} | ${valueWithN(s.trend_consistency, s.trend_consistency_n)} | ${pct(cov)} | ${pct(con)} | ${pct(aq.answer_quality)} | ${ms(s.response_ms)} |`);
  }
  return lines.join('\n');
}

function makeMarkdown(items, aqReport) {
  const full = items.find((item) => item.name === 'full_agent_72');
  if (!full) throw new Error('缺少 full_agent_72 summary，无法生成表8/表9');
  return [
    '# 论文表7-表9：GeoAI Agent 增强评价结果',
    '',
    makeOverallTable(items, aqReport),
    '',
    makeCategoryTable(full.report, aqReport),
    '',
    makeDifficultyTable(full.report, aqReport),
    '',
    '> 注：Acc_t 为期望工具召回率；Tool-F1 同时惩罚遗漏和冗余工具调用；Acc_p 采用关键词数组顺序无关的宽松关键参数匹配；SR_strict 以全部任务为分母；MRE、Hit@K、TC、Cov、Con 后的 n 表示适用任务数；AQ 为基于工具证据、政策来源、事实覆盖和过度推断检查的回答质量得分。Cov/Con 基于项目内官方政策事实库与Codex/GPT辅助标注，不使用实时网络检索。'
  ].join('\n');
}

const cli = parseArgs(process.argv.slice(2));
const inputFiles = cli.inputs
  ? String(cli.inputs).split(',').map((item) => item.trim()).filter(Boolean)
  : DEFAULT_INPUTS;
const aqFile = resolveFile(cli.aq || DEFAULT_AQ);
const outputFile = resolveFile(cli.output || DEFAULT_OUTPUT);

const items = [];
for (const input of inputFiles) {
  const file = resolveFile(input);
  const report = JSON.parse(await fs.readFile(file, 'utf8'));
  items.push({ name: runName(file), file, report });
}

let aqReport = null;
try {
  aqReport = JSON.parse(await fs.readFile(aqFile, 'utf8'));
} catch (err) {
  if (err?.code !== 'ENOENT') throw err;
}

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, `${makeMarkdown(items, aqReport)}\n`, 'utf8');

console.log(`[paper-tables] reports=${items.length}`);
console.log(`[paper-tables] aq=${aqReport ? 'yes' : 'no'}`);
console.log(`[paper-tables] output=${outputFile}`);
