#!/usr/bin/env node
import './runner/bootstrapEnv.js';
import fs from 'fs/promises';
import path from 'path';
import { PROJECT_ROOT } from './runner/bootstrapEnv.js';
import { readJsonl, writeJson } from './runner/jsonl.js';

const DEFAULT_INPUT = 'evaluation/output/runs/full_agent_72.jsonl';
const DEFAULT_FACT_BASE = 'evaluation/baselines/policy_fact_base.json';
const DEFAULT_ANNOTATIONS = 'evaluation/reports/full_agent_72_policy_fact_annotations_codex.json';
const DEFAULT_OUTPUT = 'evaluation/reports/full_agent_72_answer_quality.json';
const DEFAULT_MARKDOWN = 'evaluation/reports/full_agent_72_answer_quality.md';

const DATA_TOOL_NAMES = new Set(['clcd_analysis', 'land_transfer_analysis', 'spatial_stats_analysis']);
const POLICY_TOOL_NAMES = new Set(['policy_reference_lookup', 'knowledge_base_lookup', 'knowledge_graph_query']);
const OVERCLAIM_PATTERNS = [
  /必然/g,
  /完全由/g,
  /唯一原因/g,
  /绝对/g,
  /证明了/g,
  /直接导致/g
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
  return path.isAbsolute(input) ? input : path.join(PROJECT_ROOT, input);
}

async function readJsonIfExists(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err?.code === 'ENOENT') return fallback;
    throw err;
  }
}

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function mean(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—';
}

function mdCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function getTaskId(record) {
  return record.task?.id || record.task_id || '';
}

function getFinalAnswer(record) {
  return String(record.agent?.final_answer || '');
}

function successfulTrace(record) {
  return (record.agent?.trace || []).filter((item) => item.tool_name && !item.is_error);
}

function hasAnyTool(record, names) {
  return successfulTrace(record).some((item) => names.has(item.tool_name));
}

function textHasNumber(text) {
  return /[-+]?\d+(?:\.\d+)?\s*(?:km²|km2|%|分|m²|m2|公里|km|公顷|ha|\/\s*100)?/i.test(text);
}

function extractTopNames(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item?.key || item?.name || item?.region_name || item?.from_to || item?.transition || String(item))
    .filter(Boolean)
    .map(String);
}

function baselineEvidenceTerms(record) {
  const value = record.baseline?.value;
  if (typeof value === 'number') return [String(Number(value.toFixed ? value.toFixed(2) : value))];
  if (Array.isArray(value)) return extractTopNames(value).slice(0, 5);
  if (value?.direction) return [value.direction];
  return [];
}

function hasBaselineEvidence(record, answer) {
  if (!record.agent) return 0;
  if (textHasNumber(answer) && typeof record.baseline?.value === 'number') return 1;
  const terms = baselineEvidenceTerms(record).map(normalizeText).filter(Boolean);
  if (!terms.length) return hasAnyTool(record, DATA_TOOL_NAMES) && textHasNumber(answer) ? 1 : 0;
  const normalizedAnswer = normalizeText(answer);
  return terms.some((term) => term && normalizedAnswer.includes(term)) ? 1 : 0;
}

function policyFactsForTask(factBase, taskId) {
  return (factBase?.facts || []).filter((fact) => (fact.applicable_tasks || []).includes(taskId));
}

function sourceCitationScore(record, answer, factBase) {
  const taskId = getTaskId(record);
  const facts = policyFactsForTask(factBase, taskId);
  const normalizedAnswer = normalizeText(answer);
  const sourceHit = facts.some((fact) => {
    const urls = [fact.source_url, ...(fact.source_urls || [])].filter(Boolean);
    return urls.some((url) => normalizedAnswer.includes(normalizeText(url)))
      || normalizedAnswer.includes(normalizeText(fact.source_title));
  });
  if (sourceHit) return 1;
  if (hasAnyTool(record, POLICY_TOOL_NAMES) && /来源|政策|规划|依据|国土空间|三条控制线|耕地保护|生态保护红线/.test(answer)) return 0.5;
  return 0;
}

function manualFactCoverage(record, answer) {
  const facts = Array.isArray(record.task?.manual_fact_units) ? record.task.manual_fact_units : [];
  if (!facts.length) return null;
  const normalizedAnswer = normalizeText(answer);
  const covered = facts.filter((fact) => {
    const keywords = String(fact)
      .replace(/[，。、“”"']/g, ' ')
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2);
    return keywords.some((keyword) => normalizedAnswer.includes(normalizeText(keyword)));
  }).length;
  return covered / facts.length;
}

function overclaimRate(answer) {
  if (!answer) return null;
  const count = OVERCLAIM_PATTERNS.reduce((sum, pattern) => sum + ((answer.match(pattern) || []).length), 0);
  return count > 0 ? 1 : 0;
}

function annotationByTask(annotations) {
  const rows = annotations?.annotations || [];
  return new Map(rows.map((row) => [row.task_id, row]));
}

function scoreRecord(record, factBase, annotations) {
  const taskId = getTaskId(record);
  const answer = getFinalAnswer(record);
  const annotation = annotations.get(taskId);
  const hasAnswer = answer ? 1 : 0;
  const evidence_support = hasBaselineEvidence(record, answer);
  const source_citation = sourceCitationScore(record, answer, factBase);
  const manual_fact_coverage = manualFactCoverage(record, answer);
  const overclaim_rate = overclaimRate(answer);
  const codex_fact_coverage = annotation
    ? (Number(annotation.reference_fact_count || 0) > 0
      ? (Array.isArray(annotation.covered_reference_ids) ? annotation.covered_reference_ids.length : 0) / Number(annotation.reference_fact_count)
      : null)
    : null;
  const codex_contradiction_rate = annotation
    ? (Number(annotation.agent_fact_count || 0) > 0
      ? (Array.isArray(annotation.conflicts) ? annotation.conflicts.length : 0) / Number(annotation.agent_fact_count)
      : 0)
    : null;

  const qualityParts = [
    hasAnswer,
    evidence_support,
    source_citation,
    manual_fact_coverage,
    Number.isFinite(codex_fact_coverage) ? codex_fact_coverage : null,
    Number.isFinite(overclaim_rate) ? 1 - overclaim_rate : null,
    Number.isFinite(codex_contradiction_rate) ? 1 - codex_contradiction_rate : null
  ].filter((value) => Number.isFinite(value));

  return {
    task_id: taskId,
    category: record.task?.category || '',
    difficulty: record.task?.difficulty || '',
    answer_available: hasAnswer,
    evidence_support,
    source_citation,
    manual_fact_coverage,
    overclaim_rate,
    fact_coverage: codex_fact_coverage,
    contradiction_rate: codex_contradiction_rate,
    answer_quality: mean(qualityParts),
    fact_base_count: policyFactsForTask(factBase, taskId).length,
    annotation_source: annotation ? 'Codex/GPT辅助标注' : '',
    notes: annotation?.notes || ''
  };
}

function summarize(rows) {
  const groupBy = (items, keyFn) => {
    const groups = new Map();
    for (const row of items) {
      const key = keyFn(row) || 'unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    return groups;
  };

  const summarizeGroup = (items) => ({
    n: items.length,
    answer_available: mean(items.map((item) => item.answer_available)),
    evidence_support: mean(items.map((item) => item.evidence_support)),
    source_citation: mean(items.map((item) => item.source_citation)),
    manual_fact_coverage: mean(items.map((item) => item.manual_fact_coverage)),
    overclaim_rate: mean(items.map((item) => item.overclaim_rate)),
    fact_coverage: mean(items.map((item) => item.fact_coverage)),
    fact_coverage_n: items.filter((item) => Number.isFinite(item.fact_coverage)).length,
    contradiction_rate: mean(items.map((item) => item.contradiction_rate)),
    contradiction_rate_n: items.filter((item) => Number.isFinite(item.contradiction_rate)).length,
    answer_quality: mean(items.map((item) => item.answer_quality))
  });

  return {
    overall: summarizeGroup(rows),
    by_category: Object.fromEntries([...groupBy(rows, (row) => row.category).entries()].map(([key, items]) => [key, summarizeGroup(items)])),
    by_difficulty: Object.fromEntries([...groupBy(rows, (row) => row.difficulty).entries()].map(([key, items]) => [key, summarizeGroup(items)]))
  };
}

function makeMarkdown(report) {
  const lines = [
    '# GeoAI Agent 回答质量增强评价',
    '',
    `- 输入文件：\`${report.input_file}\``,
    `- 政策事实库：\`${report.fact_base_file}\``,
    `- 评价说明：${report.scoring_note}`,
    '',
    '## 总体',
    '',
    '| N | AQ | 证据支撑率 | 来源引用率 | Cov | Con | 过度推断率 |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    `| ${report.summary.overall.n} | ${pct(report.summary.overall.answer_quality)} | ${pct(report.summary.overall.evidence_support)} | ${pct(report.summary.overall.source_citation)} | ${pct(report.summary.overall.fact_coverage)} | ${pct(report.summary.overall.contradiction_rate)} | ${pct(report.summary.overall.overclaim_rate)} |`,
    '',
    '## 逐题证据表',
    '',
    '| 任务ID | 类别 | 难度 | AQ | 证据 | 来源 | Cov | Con | 过度推断 | 备注 |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |'
  ];

  for (const row of report.rows) {
    lines.push(`| ${mdCell(row.task_id)} | ${mdCell(row.category)} | ${mdCell(row.difficulty)} | ${pct(row.answer_quality)} | ${pct(row.evidence_support)} | ${pct(row.source_citation)} | ${pct(row.fact_coverage)} | ${pct(row.contradiction_rate)} | ${pct(row.overclaim_rate)} | ${mdCell(row.notes)} |`);
  }

  return `${lines.join('\n')}\n`;
}

const cli = parseArgs(process.argv.slice(2));
const inputFile = resolveFile(cli.input || DEFAULT_INPUT);
const factBaseFile = resolveFile(cli.facts || DEFAULT_FACT_BASE);
const annotationsFile = resolveFile(cli.annotations || DEFAULT_ANNOTATIONS);
const outputFile = resolveFile(cli.output || DEFAULT_OUTPUT);
const markdownFile = resolveFile(cli.markdown || DEFAULT_MARKDOWN);

const records = await readJsonl(inputFile);
const factBase = await readJsonIfExists(factBaseFile, { facts: [] });
const annotation = await readJsonIfExists(annotationsFile, { annotations: [] });
const annotations = annotationByTask(annotation);
const rows = records.map((record) => scoreRecord(record, factBase, annotations));
const summary = summarize(rows);

const report = {
  input_file: path.relative(PROJECT_ROOT, inputFile).replace(/\\/g, '/'),
  fact_base_file: path.relative(PROJECT_ROOT, factBaseFile).replace(/\\/g, '/'),
  annotation_file: path.relative(PROJECT_ROOT, annotationsFile).replace(/\\/g, '/'),
  generated_at: new Date().toISOString(),
  scoring_note: '回答质量评价基于项目内MCP结构化结果、任务manual_fact_units、本地政策事实库和Codex/GPT辅助标注；不调用项目LLM，不使用实时网络检索。',
  summary,
  rows
};

await writeJson(outputFile, report);
await fs.writeFile(markdownFile, makeMarkdown(report), 'utf8');

console.log(`[answer-quality] records=${records.length}`);
console.log(`[answer-quality] aq=${pct(summary.overall.answer_quality)}`);
console.log(`[answer-quality] output=${outputFile}`);
console.log(`[answer-quality] markdown=${markdownFile}`);
