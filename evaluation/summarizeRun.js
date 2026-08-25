#!/usr/bin/env node
import './runner/bootstrapEnv.js';
import path from 'path';
import { PROJECT_ROOT } from './runner/bootstrapEnv.js';
import { readJsonl, writeJson } from './runner/jsonl.js';
import { scoreRecord, summarizeScores } from './metrics/scorers.js';

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const [key, rawValue] = item.slice(2).split('=');
    args[key] = rawValue === undefined ? true : rawValue;
  }
  return args;
}

function resolveRunFile(input) {
  if (!input) throw new Error('请通过 --input=... 指定 run JSONL 文件');
  if (path.isAbsolute(input)) return input;
  return path.join(PROJECT_ROOT, input);
}

const cli = parseArgs(process.argv.slice(2));
const inputFile = resolveRunFile(cli.input);
const outputFile = cli.output
  ? (path.isAbsolute(cli.output) ? cli.output : path.join(PROJECT_ROOT, cli.output))
  : path.join(PROJECT_ROOT, 'evaluation/reports', `${path.basename(inputFile, '.jsonl')}_summary.json`);

async function main() {
  const records = await readJsonl(inputFile);
  const scores = records.map(scoreRecord);
  const summary = summarizeScores(scores);

  await writeJson(outputFile, {
    input_file: path.relative(PROJECT_ROOT, inputFile).replace(/\\/g, '/'),
    generated_at: new Date().toISOString(),
    summary,
    scores
  });

  console.log(`[eval-summary] records=${records.length}`);
  console.log(`[eval-summary] output=${outputFile}`);
}

main().catch((err) => {
  console.error(`[eval-summary] fatal: ${err?.stack || err?.message || String(err)}`);
  process.exitCode = 1;
});
