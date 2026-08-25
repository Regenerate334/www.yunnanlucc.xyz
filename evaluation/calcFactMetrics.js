#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '../../..');

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const [key, rawValue] = item.slice(2).split('=');
    args[key] = rawValue === undefined ? true : rawValue;
  }
  return args;
}

function resolvePath(value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.join(PROJECT_ROOT, value);
}

function mean(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function pct(value) {
  return value == null ? null : Number((value * 100).toFixed(2));
}

function summarize(rows) {
  const scored = rows.map((row) => {
    const referenceCount = Number(row.reference_fact_count || 0);
    const coveredCount = Array.isArray(row.covered_reference_ids)
      ? row.covered_reference_ids.length
      : Number(row.covered_fact_count || 0);
    const agentFactCount = Number(row.agent_fact_count || 0);
    const conflictCount = Array.isArray(row.conflicts)
      ? row.conflicts.length
      : Number(row.conflict_count || 0);

    return {
      ...row,
      covered_fact_count: coveredCount,
      conflict_count: conflictCount,
      fact_coverage: referenceCount > 0 ? coveredCount / referenceCount : null,
      contradiction_rate: agentFactCount > 0 ? conflictCount / agentFactCount : 0
    };
  });

  const referenceTotal = scored.reduce((sum, row) => sum + Number(row.reference_fact_count || 0), 0);
  const coveredTotal = scored.reduce((sum, row) => sum + Number(row.covered_fact_count || 0), 0);
  const agentFactTotal = scored.reduce((sum, row) => sum + Number(row.agent_fact_count || 0), 0);
  const conflictTotal = scored.reduce((sum, row) => sum + Number(row.conflict_count || 0), 0);

  return {
    n: scored.length,
    macro_fact_coverage: mean(scored.map((row) => row.fact_coverage)),
    macro_contradiction_rate: mean(scored.map((row) => row.contradiction_rate)),
    micro_fact_coverage: referenceTotal > 0 ? coveredTotal / referenceTotal : null,
    micro_contradiction_rate: agentFactTotal > 0 ? conflictTotal / agentFactTotal : 0,
    reference_fact_total: referenceTotal,
    covered_fact_total: coveredTotal,
    agent_fact_total: agentFactTotal,
    conflict_total: conflictTotal,
    rows: scored
  };
}

function makeMarkdown(report) {
  const lines = [
    '# Codex标注事实单元可信度结果',
    '',
    `- 标注文件：\`${report.annotation_file}\``,
    `- 任务数：${report.summary.n}`,
    `- 宏平均事实覆盖率 Cov：${pct(report.summary.macro_fact_coverage)}%`,
    `- 宏平均事实矛盾率 Con：${pct(report.summary.macro_contradiction_rate)}%`,
    `- 微平均事实覆盖率：${pct(report.summary.micro_fact_coverage)}% (${report.summary.covered_fact_total}/${report.summary.reference_fact_total})`,
    `- 微平均事实矛盾率：${pct(report.summary.micro_contradiction_rate)}% (${report.summary.conflict_total}/${report.summary.agent_fact_total})`,
    '',
    '| 任务ID | 难度 | 参考事实数 | 覆盖数 | Cov/% | Agent事实数 | 冲突数 | Con/% | 备注 |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |'
  ];

  for (const row of report.summary.rows) {
    lines.push([
      row.task_id,
      row.difficulty,
      row.reference_fact_count,
      row.covered_fact_count,
      pct(row.fact_coverage),
      row.agent_fact_count,
      row.conflict_count,
      pct(row.contradiction_rate),
      String(row.notes || '').replace(/\|/g, '\\|')
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }

  return `${lines.join('\n')}\n`;
}

const cli = parseArgs(process.argv.slice(2));
const annotationFile = resolvePath(cli.input || 'evaluation/reports/full_agent_72_policy_fact_annotations_codex.json');
const outputFile = resolvePath(cli.output || 'evaluation/reports/full_agent_72_policy_fact_summary_codex.json');
const markdownFile = resolvePath(cli.markdown || 'evaluation/reports/full_agent_72_policy_fact_summary_codex.md');

const raw = await fs.readFile(annotationFile, 'utf-8');
const annotation = JSON.parse(raw);
const summary = summarize(annotation.annotations || []);
const report = {
  annotation_file: path.relative(PROJECT_ROOT, annotationFile).replace(/\\/g, '/'),
  generated_at: new Date().toISOString(),
  evaluator: annotation.evaluator,
  scope: annotation.scope,
  scoring_note: annotation.scoring_note,
  summary
};

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
await fs.writeFile(markdownFile, makeMarkdown(report), 'utf-8');

console.log(`[fact-metrics] annotations=${summary.n}`);
console.log(`[fact-metrics] macro_cov=${pct(summary.macro_fact_coverage)}% macro_con=${pct(summary.macro_contradiction_rate)}%`);
console.log(`[fact-metrics] micro_cov=${pct(summary.micro_fact_coverage)}% micro_con=${pct(summary.micro_contradiction_rate)}%`);
console.log(`[fact-metrics] output=${outputFile}`);
console.log(`[fact-metrics] markdown=${markdownFile}`);
