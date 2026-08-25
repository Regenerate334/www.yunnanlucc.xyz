#!/usr/bin/env node
import './runner/bootstrapEnv.js';
import fs from 'fs/promises';
import path from 'path';
import { PROJECT_ROOT } from './runner/bootstrapEnv.js';

const DEFAULT_CORPUS = 'server/knowledge/corpus/policy_corpus.json';
const DEFAULT_TASK_DIR = 'evaluation/tasks';
const DEFAULT_OUTPUT = 'evaluation/baselines/policy_fact_base.json';

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

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeLevel(value) {
  const s = normalizeText(value);
  if (!s) return '';
  if (s === '国家' || s === 'national') return 'national';
  if (s === '省' || s === '省级' || s === 'province') return 'province';
  if (s === '市' || s === '市级' || s === 'city') return 'city';
  if (s === '县' || s === '县级' || s === 'county') return 'county';
  return s;
}

function parseYear(value) {
  const year = Number(value);
  return Number.isFinite(year) ? Math.trunc(year) : null;
}

function asKeywords(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value).split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean);
}

function hasAny(text, keywords) {
  const normalized = normalizeText(text);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

function regionMatches(entry, region) {
  const expected = normalizeText(region);
  if (!expected) return true;
  const actual = normalizeText(entry.region);
  if (!actual) return false;
  if (actual === '全国' || normalizeLevel(entry.level) === 'national') return true;
  return actual === expected || actual.includes(expected) || expected.includes(actual);
}

function levelMatches(entry, level) {
  const expected = normalizeLevel(level);
  if (!expected) return true;
  return normalizeLevel(entry.level) === expected;
}

function yearMatches(entry, { year, year_range }) {
  const entryYear = parseYear(String(entry.date || '').slice(0, 4));
  if (!entryYear) return true;
  const targetYear = parseYear(year);
  if (targetYear) return entryYear === targetYear;
  const range = Array.isArray(year_range) ? year_range.map(parseYear).filter(Number.isFinite) : [];
  if (range.length >= 2) return entryYear >= range[0] && entryYear <= range[1];
  return true;
}

function policyArgsForTask(task) {
  return task.expected_args?.policy_reference_lookup
    || (task.baseline?.tool === 'policy_reference_lookup' ? task.baseline.args : null);
}

function scoreEntry(entry, args) {
  if (!args) return 0;
  if (!regionMatches(entry, args.region)) return 0;
  if (!levelMatches(entry, args.level)) return 0;
  if (!yearMatches(entry, args)) return 0;

  const keywords = asKeywords(args.keywords);
  const haystack = [
    entry.title,
    entry.issuer,
    entry.doc_no,
    entry.summary,
    ...(Array.isArray(entry.keywords) ? entry.keywords : [])
  ].join(' ');

  let score = 0;
  if (normalizeText(entry.region) === normalizeText(args.region)) score += 4;
  if (normalizeLevel(entry.level) === normalizeLevel(args.level)) score += 2;
  score += keywords.filter((keyword) => hasAny(haystack, [keyword])).length * 3;
  if (Array.isArray(entry.sources) && entry.sources.length) score += 1;
  return score;
}

async function loadTasks(taskDir) {
  const files = await fs.readdir(taskDir);
  const taskFiles = files.filter((file) => file.endsWith('.json'));
  const tasks = [];
  for (const file of taskFiles) {
    const rows = JSON.parse(await fs.readFile(path.join(taskDir, file), 'utf8'));
    if (Array.isArray(rows)) tasks.push(...rows);
  }
  return tasks;
}

function buildFactBase(corpus, tasks) {
  const factsById = new Map();

  for (const entry of corpus) {
    const factId = `${entry.id}::summary`;
    factsById.set(factId, {
      fact_id: factId,
      source_id: entry.id,
      source_title: entry.title,
      source_url: Array.isArray(entry.sources) ? entry.sources[0] || '' : '',
      source_urls: Array.isArray(entry.sources) ? entry.sources : [],
      issuer: entry.issuer || '',
      date: entry.date || '',
      level: entry.level || '',
      region: entry.region || '',
      topic: Array.isArray(entry.keywords) ? entry.keywords : [],
      fact_text: entry.summary || '',
      applicable_tasks: []
    });
  }

  for (const task of tasks) {
    const args = policyArgsForTask(task);
    if (!args) continue;
    const matches = corpus
      .map((entry) => ({ entry, score: scoreEntry(entry, args) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Number(args.top_n || 5));

    for (const { entry } of matches) {
      const fact = factsById.get(`${entry.id}::summary`);
      if (fact && !fact.applicable_tasks.includes(task.id)) {
        fact.applicable_tasks.push(task.id);
      }
    }
  }

  return {
    generated_at: new Date().toISOString(),
    source: {
      corpus_file: DEFAULT_CORPUS,
      task_dir: DEFAULT_TASK_DIR,
      note: '本事实库由项目内政策/规划文献索引库整理生成，不使用实时网络检索。source_url/source_urls 来自本地 policy_corpus.json 中已维护的官方来源链接。'
    },
    facts: [...factsById.values()].filter((fact) => fact.fact_text)
  };
}

const cli = parseArgs(process.argv.slice(2));
const corpusFile = resolveFile(cli.corpus || DEFAULT_CORPUS);
const taskDir = resolveFile(cli.tasks || DEFAULT_TASK_DIR);
const outputFile = resolveFile(cli.output || DEFAULT_OUTPUT);

const corpus = JSON.parse(await fs.readFile(corpusFile, 'utf8'));
const tasks = await loadTasks(taskDir);
const factBase = buildFactBase(Array.isArray(corpus) ? corpus : [], tasks);

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, `${JSON.stringify(factBase, null, 2)}\n`, 'utf8');

const applicableCount = factBase.facts.filter((fact) => fact.applicable_tasks.length).length;
console.log(`[policy-facts] facts=${factBase.facts.length}`);
console.log(`[policy-facts] applicable_facts=${applicableCount}`);
console.log(`[policy-facts] output=${outputFile}`);
