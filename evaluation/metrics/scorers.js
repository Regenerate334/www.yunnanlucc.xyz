import { extractBaselineValue } from '../runner/extractors.js';

function isNumberLike(value) {
  return value !== null && value !== '' && Number.isFinite(Number(value));
}

function sameValue(actual, expected) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false;
    return expected.every((item, index) => sameValue(actual[index], item));
  }
  if (isNumberLike(actual) && isNumberLike(expected)) {
    return Number(actual) === Number(expected);
  }
  return String(actual ?? '').trim() === String(expected ?? '').trim();
}

function relaxedSameValue(actual, expected, key = '') {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    if (/keywords?|terms?|tags?/i.test(key)) {
      const actualItems = new Set(actual.map((item) => normalizeText(item)));
      return expected.every((item) => actualItems.has(normalizeText(item)));
    }
    return sameValue(actual, expected);
  }
  return sameValue(actual, expected);
}

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function partialArgsMatch(actual = {}, expected = {}) {
  return Object.entries(expected).every(([key, expectedValue]) => sameValue(actual?.[key], expectedValue));
}

function relaxedPartialArgsMatch(actual = {}, expected = {}) {
  return Object.entries(expected).every(([key, expectedValue]) => relaxedSameValue(actual?.[key], expectedValue, key));
}

function mean(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function getActualTrace(record, toolName) {
  return (record.agent?.trace || []).find((item) => item.tool_name === toolName) || null;
}

function getActualToolNames(record) {
  return (record.agent?.trace || []).map((item) => item.tool_name).filter(Boolean);
}

function getSuccessfulToolNames(record) {
  return (record.agent?.trace || [])
    .filter((item) => item.tool_name && !item.is_error)
    .map((item) => item.tool_name);
}

function getToolTraceSummary(record) {
  return (record.agent?.trace || []).map((item) => ({
    tool_name: item.tool_name,
    args: item.args || {},
    is_error: !!item.is_error,
    elapsed_ms: item.elapsed_ms ?? null
  }));
}

function scoreToolAccuracy(record) {
  const expected = record.task?.expected_tools || [];
  if (!expected.length) return null;
  const actual = new Set(getActualToolNames(record));
  return expected.every((toolName) => actual.has(toolName)) ? 1 : 0;
}

function scoreToolPrecision(record) {
  const expected = record.task?.expected_tools || [];
  if (!expected.length) return null;
  const actual = getSuccessfulToolNames(record);
  if (!actual.length) return 0;
  const expectedSet = new Set(expected);
  const hit = new Set(actual.filter((toolName) => expectedSet.has(toolName))).size;
  return hit / actual.length;
}

function scoreToolF1(record) {
  const recall = scoreToolAccuracy(record);
  const precision = scoreToolPrecision(record);
  if (!Number.isFinite(recall) || !Number.isFinite(precision)) return null;
  if (recall === 0 && precision === 0) return 0;
  return (2 * recall * precision) / (recall + precision);
}

function scoreParamAccuracy(record, { relaxed = false } = {}) {
  const expectedArgs = record.task?.expected_args || {};
  const entries = Object.entries(expectedArgs);
  if (!entries.length) return null;

  const scores = entries.map(([toolName, args]) => {
    const trace = getActualTrace(record, toolName);
    if (!trace) return 0;
    const matcher = relaxed ? relaxedPartialArgsMatch : partialArgsMatch;
    return matcher(trace.args || {}, args) ? 1 : 0;
  });
  return mean(scores);
}

function scoreValidSuccess(record) {
  if (!record.agent) return null;
  if (record.error) return 0;
  if (!record.agent.final_answer && !(record.agent.trace || []).length) return 0;
  return (record.agent.trace || []).some((item) => item.is_error) ? 0 : 1;
}

function scoreStrictSuccess(record) {
  if (!record.agent) return 0;
  return scoreValidSuccess(record) === 1 ? 1 : 0;
}

function scoreAnswerAvailable(record) {
  return record.agent?.final_answer ? 1 : 0;
}

function scoreToolErrorCount(record) {
  return (record.agent?.trace || []).filter((item) => item.is_error).length;
}

function scoreResultConsistency(record) {
  const extract = record.task?.baseline?.extract;
  const baselineValue = record.baseline?.value;
  const baselineTool = record.task?.baseline?.tool;
  if (!extract || baselineValue == null || !baselineTool || !record.agent) return { mre: null, hit_k: null, trend_consistency: null };

  const trace = getActualTrace(record, baselineTool);
  if (!trace?.structuredContent) return { mre: null, hit_k: null, trend_consistency: null };

  const actualValue = extractBaselineValue(trace.structuredContent, extract);

  if (typeof baselineValue === 'number' && typeof actualValue === 'number') {
    return {
      mre: Math.abs(actualValue - baselineValue) / (Math.abs(baselineValue) + 1e-9),
      hit_k: null,
      trend_consistency: null
    };
  }

  if (extract.type === 'trend' && baselineValue?.direction && actualValue?.direction) {
    return {
      mre: null,
      hit_k: null,
      trend_consistency: baselineValue.direction === actualValue.direction ? 1 : 0
    };
  }

  if (Array.isArray(baselineValue) && Array.isArray(actualValue)) {
    const k = extract.k || baselineValue.length || actualValue.length;
    const expected = new Set(baselineValue.slice(0, k).map((item) => normalizeText(item.key || item.name || String(item))));
    const actualItems = extract.type === 'fact_units' ? actualValue : actualValue.slice(0, k);
    const actual = new Set(actualItems.map((item) => normalizeText(item.key || item.name || String(item))));
    const hit = [...actual].filter((item) => expected.has(item)).length;
    return {
      mre: null,
      hit_k: k > 0 ? hit / k : null,
      trend_consistency: null
    };
  }

  return { mre: null, hit_k: null, trend_consistency: null };
}

export function scoreRecord(record) {
  const consistency = scoreResultConsistency(record);
  const toolRecall = scoreToolAccuracy(record);
  const strictSuccess = scoreStrictSuccess(record);
  return {
    task_id: record.task?.id,
    category: record.task?.category,
    difficulty: record.task?.difficulty,
    tool_accuracy: toolRecall,
    tool_recall: toolRecall,
    tool_precision: scoreToolPrecision(record),
    tool_f1: scoreToolF1(record),
    param_accuracy: scoreParamAccuracy(record, { relaxed: true }),
    param_accuracy_relaxed: scoreParamAccuracy(record, { relaxed: true }),
    param_accuracy_strict: scoreParamAccuracy(record),
    success_rate: strictSuccess,
    strict_success: strictSuccess,
    valid_success_rate: scoreValidSuccess(record),
    answer_available_rate: scoreAnswerAvailable(record),
    tool_error_count: scoreToolErrorCount(record),
    mre: consistency.mre,
    hit_k: consistency.hit_k,
    trend_consistency: consistency.trend_consistency,
    fact_coverage: record.manual_scores?.fact_coverage ?? null,
    contradiction_rate: record.manual_scores?.contradiction_rate ?? null,
    response_ms: record.agent?.elapsed_ms ?? null,
    tool_count: record.agent?.trace?.length ?? null,
    expected_tools: record.task?.expected_tools || [],
    actual_tools: getActualToolNames(record),
    expected_args: record.task?.expected_args || {},
    actual_trace: getToolTraceSummary(record),
    baseline_error: record.baseline?.is_error ?? null,
    agent_error: record.error?.message || null
  };
}

export function summarizeScores(scores) {
  const groupBy = (items, keyFn) => {
    const groups = new Map();
    for (const score of items) {
      const key = keyFn(score) || 'unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(score);
    }
    return groups;
  };

  const summarizeGroup = (items) => ({
    n: items.length,
    tool_accuracy: mean(items.map((item) => item.tool_accuracy)),
    tool_recall: mean(items.map((item) => item.tool_recall)),
    tool_precision: mean(items.map((item) => item.tool_precision)),
    tool_f1: mean(items.map((item) => item.tool_f1)),
    param_accuracy: mean(items.map((item) => item.param_accuracy)),
    param_accuracy_relaxed: mean(items.map((item) => item.param_accuracy_relaxed)),
    param_accuracy_strict: mean(items.map((item) => item.param_accuracy_strict)),
    success_rate: mean(items.map((item) => item.success_rate)),
    strict_success: mean(items.map((item) => item.strict_success)),
    valid_success_rate: mean(items.map((item) => item.valid_success_rate)),
    answer_available_rate: mean(items.map((item) => item.answer_available_rate)),
    tool_error_count: items.reduce((sum, item) => sum + (Number.isFinite(item.tool_error_count) ? item.tool_error_count : 0), 0),
    mre: mean(items.map((item) => item.mre)),
    mre_n: items.filter((item) => Number.isFinite(item.mre)).length,
    hit_k: mean(items.map((item) => item.hit_k)),
    hit_k_n: items.filter((item) => Number.isFinite(item.hit_k)).length,
    trend_consistency: mean(items.map((item) => item.trend_consistency)),
    trend_consistency_n: items.filter((item) => Number.isFinite(item.trend_consistency)).length,
    fact_coverage: mean(items.map((item) => item.fact_coverage)),
    fact_coverage_n: items.filter((item) => Number.isFinite(item.fact_coverage)).length,
    contradiction_rate: mean(items.map((item) => item.contradiction_rate)),
    contradiction_rate_n: items.filter((item) => Number.isFinite(item.contradiction_rate)).length,
    response_ms: mean(items.map((item) => item.response_ms)),
    tool_count: mean(items.map((item) => item.tool_count))
  });

  const categoryGroups = groupBy(scores, (score) => score.category);
  const difficultyGroups = groupBy(scores, (score) => score.difficulty);
  const categoryDifficultyGroups = groupBy(scores, (score) => `${score.category || 'unknown'}::${score.difficulty || 'unknown'}`);

  const formatGroups = (groups, splitKey = false) => Object.fromEntries([...groups.entries()].map(([key, items]) => {
    if (!splitKey) return [key, summarizeGroup(items)];
    const [category, difficulty] = key.split('::');
    return [key, { category, difficulty, ...summarizeGroup(items) }];
  }));

  return {
    overall: summarizeGroup(scores),
    by_category: formatGroups(categoryGroups),
    by_difficulty: formatGroups(difficultyGroups),
    by_category_difficulty: formatGroups(categoryDifficultyGroups, true)
  };
}

export function summarizeScoresLegacy(scores) {
  const groups = new Map();
  for (const score of scores) {
    const key = score.category || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(score);
  }

  const summarizeGroup = (items) => ({
    n: items.length,
    tool_accuracy: mean(items.map((item) => item.tool_accuracy)),
    tool_recall: mean(items.map((item) => item.tool_recall)),
    tool_precision: mean(items.map((item) => item.tool_precision)),
    tool_f1: mean(items.map((item) => item.tool_f1)),
    param_accuracy: mean(items.map((item) => item.param_accuracy)),
    param_accuracy_relaxed: mean(items.map((item) => item.param_accuracy_relaxed)),
    param_accuracy_strict: mean(items.map((item) => item.param_accuracy_strict)),
    success_rate: mean(items.map((item) => item.success_rate)),
    strict_success: mean(items.map((item) => item.strict_success)),
    valid_success_rate: mean(items.map((item) => item.valid_success_rate)),
    answer_available_rate: mean(items.map((item) => item.answer_available_rate)),
    tool_error_count: items.reduce((sum, item) => sum + (Number.isFinite(item.tool_error_count) ? item.tool_error_count : 0), 0),
    mre: mean(items.map((item) => item.mre)),
    mre_n: items.filter((item) => Number.isFinite(item.mre)).length,
    hit_k: mean(items.map((item) => item.hit_k)),
    hit_k_n: items.filter((item) => Number.isFinite(item.hit_k)).length,
    trend_consistency: mean(items.map((item) => item.trend_consistency)),
    trend_consistency_n: items.filter((item) => Number.isFinite(item.trend_consistency)).length,
    fact_coverage: mean(items.map((item) => item.fact_coverage)),
    fact_coverage_n: items.filter((item) => Number.isFinite(item.fact_coverage)).length,
    contradiction_rate: mean(items.map((item) => item.contradiction_rate)),
    contradiction_rate_n: items.filter((item) => Number.isFinite(item.contradiction_rate)).length,
    response_ms: mean(items.map((item) => item.response_ms)),
    tool_count: mean(items.map((item) => item.tool_count))
  });

  return {
    overall: summarizeGroup(scores),
    by_category: Object.fromEntries([...groups.entries()].map(([key, items]) => [key, summarizeGroup(items)]))
  };
}
