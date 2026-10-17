import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BenchmarkRun } from '../types';
import { aggregateCapabilityRun, selectCapabilityRun, selectCompletedBenchmarkRuns, summarizeCapabilityModel, validateCapabilityModelComparison } from './capabilityMetrics';

function makeRun(results: BenchmarkRun['results'], status: BenchmarkRun['status'] = 'completed'): BenchmarkRun {
  return {
    runId: 'run-1', status, modelIds: ['qwen2.5:3b'], benchmarkIds: [],
    settings: { temperature: 0, topP: 0.9, maxTokens: 128, timeoutSeconds: 180 },
    createdAt: '', updatedAt: '', completedAt: null,
    progress: { completed: results.length, total: results.length, currentModelId: null, currentBenchmarkId: null },
    results, error: null,
  };
}

function result(overrides: Partial<BenchmarkRun['results'][number]> = {}): BenchmarkRun['results'][number] {
  return {
    resultId: 'result-1', runId: 'run-1', modelId: 'qwen2.5:3b', benchmarkId: 'case-1', category: 'code',
    status: 'success', startedAt: '', completedAt: '', output: '', inputTokens: 2, outputTokens: 3,
    wallClockLatencyMs: 100, ollamaTotalMs: 90, generationMs: 50, tokPerSec: 60,
    evaluationStatus: 'evaluated', passed: true, score: 1, maxScore: 1,
    scoringMethod: 'exact-normalized', error: null,
    ...overrides,
  };
}

test('pass rate uses only valid evaluated cases and reports other outcomes separately', () => {
  const metrics = aggregateCapabilityRun(makeRun([
    result({ resultId: 'pass', passed: true }),
    result({ resultId: 'fail', passed: false, score: 0 }),
    result({ resultId: 'inference-failed', status: 'failed', evaluationStatus: 'not_evaluated', passed: null, score: null, wallClockLatencyMs: null }),
    result({ resultId: 'timeout', status: 'timeout', evaluationStatus: 'not_evaluated', passed: null, score: null, wallClockLatencyMs: null }),
    result({ resultId: 'unavailable', evaluationStatus: 'not_evaluated', passed: null, score: null }),
    result({ resultId: 'invalid-evaluation', score: null, passed: true }),
  ]));
  assert.deepEqual(metrics[0], {
    modelId: 'qwen2.5:3b', category: 'code', evaluatedCount: 2, passedCount: 1,
    passRatePercent: 50, inferenceFailedCount: 2, evaluationUnavailableCount: 2,
    latencySampleCount: 4, medianWallLatencyMs: 100,
  });
});

test('empty history and non-completed runs produce no capability metrics', () => {
  assert.deepEqual(aggregateCapabilityRun(null), []);
  assert.deepEqual(aggregateCapabilityRun(makeRun([result()], 'running')), []);
  assert.deepEqual(selectCompletedBenchmarkRuns([]), []);
});

test('multiple models and categories aggregate independently with no style or routing fields', () => {
  const metrics = aggregateCapabilityRun(makeRun([
    result({ modelId: 'qwen2.5:3b', category: 'code', wallClockLatencyMs: 100 }),
    result({ resultId: 'r2', modelId: 'qwen2.5:3b', category: 'code', passed: false, score: 0, wallClockLatencyMs: 300 }),
    result({ resultId: 'r3', modelId: 'gemma4:cloud', category: 'reasoning', passed: true, score: 1, wallClockLatencyMs: null }),
  ]));
  assert.deepEqual(metrics.map(item => [item.modelId, item.category, item.evaluatedCount, item.passRatePercent]), [
    ['qwen2.5:3b', 'code', 2, 50], ['gemma4:cloud', 'reasoning', 1, 100],
  ]);
  assert.equal(metrics[0].medianWallLatencyMs, 200);
  assert.equal(metrics[1].medianWallLatencyMs, null);
  assert.equal('styleScore' in metrics[0], false);
  assert.equal('ratio' in metrics[0], false);
  assert.equal('candidateName' in metrics[0], false);
});

test('completed-run selection ignores running and failed run history', () => {
  const completed = makeRun([]);
  const runs = [completed, { ...completed, runId: 'running', status: 'running' as const }, { ...completed, runId: 'failed', status: 'failed' as const }];
  assert.deepEqual(selectCompletedBenchmarkRuns(runs).map(run => run.runId), ['run-1']);
  assert.equal(selectCapabilityRun(runs, 'running')?.runId, 'run-1');
  assert.equal(selectCapabilityRun(runs, 'run-1')?.runId, 'run-1');
  assert.equal(selectCapabilityRun([], ''), null);
});

test('missing and invalid wall latency values are excluded from median samples', () => {
  const metrics = aggregateCapabilityRun(makeRun([
    result({ resultId: 'a', wallClockLatencyMs: 100 }),
    result({ resultId: 'b', wallClockLatencyMs: null }),
    result({ resultId: 'c', wallClockLatencyMs: -10 }),
    result({ resultId: 'd', wallClockLatencyMs: Number.NaN }),
  ]));
  assert.equal(metrics[0].latencySampleCount, 1);
  assert.equal(metrics[0].medianWallLatencyMs, 100);
});

test('model summary reports actual evaluated samples and median recorded wall latency', () => {
  const summary = summarizeCapabilityModel(makeRun([
    result({ resultId: 'a', passed: true, wallClockLatencyMs: 100 }),
    result({ resultId: 'b', passed: false, score: 0, wallClockLatencyMs: 300 }),
    result({ resultId: 'c', status: 'failed', evaluationStatus: 'not_evaluated', passed: null, score: null, wallClockLatencyMs: null }),
  ]), 'qwen2.5:3b');
  assert.equal(summary.evaluatedCount, 2);
  assert.equal(summary.passedCount, 1);
  assert.equal(summary.passRatePercent, 50);
  assert.equal(summary.inferenceFailedCount, 1);
  assert.equal(summary.medianWallLatencyMs, 200);
});

test('measured wall latency includes recorded failed-attempt durations but omits missing values', () => {
  const run = makeRun([
    result({ resultId: 'ok', wallClockLatencyMs: 100 }),
    result({ resultId: 'failed-measured', status: 'failed', evaluationStatus: 'not_evaluated', passed: null, score: null, wallClockLatencyMs: 300 }),
    result({ resultId: 'failed-no-measure', status: 'timeout', evaluationStatus: 'not_evaluated', passed: null, score: null, wallClockLatencyMs: null }),
  ]);
  const metric = aggregateCapabilityRun(run)[0];
  assert.equal(metric.evaluatedCount, 1);
  assert.equal(metric.inferenceFailedCount, 2);
  assert.equal(metric.latencySampleCount, 2);
  assert.equal(metric.medianWallLatencyMs, 200);
});

test('model comparisons require each model to have the selected run case set', () => {
  const run = {
    ...makeRun([
      result({ resultId: 'a1', benchmarkId: 'case-1' }),
      result({ resultId: 'a2', benchmarkId: 'case-2' }),
      result({ resultId: 'b1', modelId: 'model-b', benchmarkId: 'case-1' }),
    ]),
    modelIds: ['qwen2.5:3b', 'model-b'], benchmarkIds: ['case-1', 'case-2'],
  };
  const incomplete = validateCapabilityModelComparison(run, run.modelIds);
  assert.equal(incomplete.comparable, false);
  assert.equal(incomplete.configurationShared, true);
  assert.equal(incomplete.reason, 'case-coverage-differs');
  assert.deepEqual(incomplete.casesByModel[1].missingCaseIds, ['case-2']);
  const completeRun = { ...run, results: [...run.results, result({ resultId: 'b2', modelId: 'model-b', benchmarkId: 'case-2', status: 'failed', evaluationStatus: 'not_evaluated', passed: null, score: null })] };
  assert.equal(validateCapabilityModelComparison(completeRun, completeRun.modelIds).comparable, true);
  assert.equal(validateCapabilityModelComparison(run, ['qwen2.5:3b']).reason, 'select-two-models');
});
