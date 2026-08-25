#!/usr/bin/env node
import './runner/bootstrapEnv.js';
import path from 'path';
import { PROJECT_ROOT } from './runner/bootstrapEnv.js';
import { appendJsonl, ensureDir, writeJson } from './runner/jsonl.js';
import { loadTasks } from './runner/taskLoader.js';
import { runBaseline } from './runner/baseline.js';
import { runAgentTask } from './runner/agentLoop.js';
import { closeMcpClient } from '../../../server/utils/ai/core/mcpClientTools.js';

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const [key, rawValue] = item.slice(2).split('=');
    args[key] = rawValue === undefined ? true : rawValue;
  }
  return args;
}

function toBool(value) {
  return value === true || String(value).toLowerCase() === 'true' || value === '1';
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

const cli = parseArgs(process.argv.slice(2));
const category = cli.category || 'all';
const profile = cli.profile || 'full';
const model = cli.model || process.env.EVAL_MODEL || process.env.CHAT_MODEL || 'deepseek-v4-pro';
const limit = Number.parseInt(cli.limit || '0', 10) || 0;
const baselineOnly = toBool(cli['baseline-only']);
const runId = cli.run || `${timestampForFile()}_${profile}_${category}`;
const outputDir = path.join(PROJECT_ROOT, 'evaluation/output/runs');
const reportDir = path.join(PROJECT_ROOT, 'evaluation/reports');
const outputFile = path.join(outputDir, `${runId}.jsonl`);
const latestReportFile = path.join(reportDir, 'latest_run.json');

async function main() {
  await ensureDir(outputDir);
  await ensureDir(reportDir);

  const tasks = await loadTasks({ category, limit });
  const meta = {
    run_id: runId,
    category,
    profile,
    model,
    baseline_only: baselineOnly,
    task_count: tasks.length,
    output_file: path.relative(PROJECT_ROOT, outputFile).replace(/\\/g, '/'),
    started_at: new Date().toISOString()
  };

  console.log(`[eval] run=${runId}, profile=${profile}, category=${category}, tasks=${tasks.length}`);

  let completed = 0;
  let failed = 0;

  for (const task of tasks) {
    const record = {
      run_id: runId,
      task,
      baseline: null,
      agent: null,
      error: null,
      created_at: new Date().toISOString()
    };

    try {
      record.baseline = await runBaseline(task);
      if (!baselineOnly) {
        record.agent = await runAgentTask(task, { model, profile });
      }
      completed += 1;
      console.log(`[eval] ok ${task.id}`);
    } catch (err) {
      failed += 1;
      record.error = {
        message: err?.message || String(err),
        stack: err?.stack || null
      };
      console.error(`[eval] fail ${task.id}: ${record.error.message}`);
    }

    await appendJsonl(outputFile, record);
  }

  const report = {
    ...meta,
    completed,
    failed,
    finished_at: new Date().toISOString()
  };
  await writeJson(latestReportFile, report);
  console.log(`[eval] output=${outputFile}`);
  console.log(`[eval] latest=${latestReportFile}`);
}

main()
  .catch((err) => {
    console.error(`[eval] fatal: ${err?.stack || err?.message || String(err)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMcpClient().catch(() => {});
  });
