import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendModel } from './blendpilot.mjs';

function result({ modelId, benchmarkId, passed, latency = 100, status = 'success', evaluationStatus = 'evaluated' }) {
  return {
    resultId: `${modelId}-${benchmarkId}`, runId: 'run-1', modelId, benchmarkId, category: 'code',
    status, startedAt: '', completedAt: '', output: '', inputTokens: 5, outputTokens: 2,
    wallClockLatencyMs: latency, ollamaTotalMs: latency, generationMs: null, tokPerSec: null,
    evaluationStatus, passed: evaluationStatus === 'evaluated' && status === 'success' ? passed : null,
    score: evaluationStatus === 'evaluated' && status === 'success' ? Number(passed) : null,
    maxScore: 1, scoringMethod: 'exact-normalized', error: status === 'success' ? null : 'test failure',
  };
}

function run(results, modelIds = ['baseline', 'candidate'], status = 'completed') {
  return {
    runId: 'run-1', status, modelIds, benchmarkIds: results.map(item => item.benchmarkId),
    settings: { temperature: 0, topP: 0.9, maxTokens: 128, timeoutSeconds: 180 },
    createdAt: '', updatedAt: '', completedAt: '',
    progress: { completed: results.length, total: results.length, currentModelId: null, currentBenchmarkId: null },
    results, error: null,
  };
}

function input(benchmarkRun, overrides = {}) {
  return {
    run: benchmarkRun, category: 'code', comparisonModelId: 'baseline',
    preference: 'correctness', minimumEvaluations: 2, ...overrides,
  };
}

test('correctness-first recommends the model with the higher valid pass rate', () => {
  const benchmarkRun = run([
    ...[true, true, false, false].map((passed, index) => result({ modelId: 'baseline', benchmarkId: `b${index}`, passed, latency: 80 })),
    ...[true, true, true, false].map((passed, index) => result({ modelId: 'candidate', benchmarkId: `b${index}`, passed, latency: 90 })),
  ]);
  const recommendation = recommendModel(input(benchmarkRun));
  assert.equal(recommendation.status, 'recommended');
  assert.equal(recommendation.recommendedModelId, 'candidate');
  assert.equal(recommendation.recommendedModel.passRatePercent, 75);
  assert.match(recommendation.reason, /b0, b1, b2, b3/);
});

test('latency-first recommends the faster eligible model and reports its correctness evidence', () => {
  const benchmarkRun = run([
    ...[true, true, true, true].map((passed, index) => result({ modelId: 'baseline', benchmarkId: `b${index}`, passed, latency: 300 })),
    ...[true, true, false, false].map((passed, index) => result({ modelId: 'candidate', benchmarkId: `b${index}`, passed, latency: 100 })),
  ]);
  const recommendation = recommendModel(input(benchmarkRun, { preference: 'latency' }));
  assert.equal(recommendation.recommendedModelId, 'candidate');
  assert.equal(recommendation.recommendedModel.medianWallLatencyMs, 100);
  assert.equal(recommendation.recommendedModel.passRatePercent, 50);
});

test('failed inference and unavailable evaluation are excluded from valid sample count', () => {
  const benchmarkRun = run([
    result({ modelId: 'baseline', benchmarkId: 'baseline-pass', passed: true }),
    result({ modelId: 'baseline', benchmarkId: 'baseline-fail', passed: false }),
    result({ modelId: 'baseline', benchmarkId: 'baseline-inference-error', passed: false, status: 'failed' }),
    result({ modelId: 'baseline', benchmarkId: 'baseline-eval-na', passed: false, evaluationStatus: 'not_evaluated' }),
    result({ modelId: 'candidate', benchmarkId: 'candidate-pass', passed: true }),
    result({ modelId: 'candidate', benchmarkId: 'candidate-pass-2', passed: true }),
  ]);
  const recommendation = recommendModel(input(benchmarkRun));
  assert.equal(recommendation.comparisonModel.evaluatedCount, 2);
  assert.equal(recommendation.comparisonModel.inferenceFailedCount, 1);
  assert.equal(recommendation.comparisonModel.unavailableEvaluationCount, 1);
  assert.equal(recommendation.comparisonModel.passRatePercent, 50);
  assert.equal(recommendation.recommendedModelId, 'candidate');
});

test('latency-first does not infer latency when measurements are missing', () => {
  const benchmarkRun = run([
    result({ modelId: 'baseline', benchmarkId: 'base-1', passed: true, latency: null }),
    result({ modelId: 'baseline', benchmarkId: 'base-2', passed: true, latency: null }),
    result({ modelId: 'candidate', benchmarkId: 'cand-1', passed: true, latency: null }),
    result({ modelId: 'candidate', benchmarkId: 'cand-2', passed: true, latency: null }),
  ]);
  const recommendation = recommendModel(input(benchmarkRun, { preference: 'latency' }));
  assert.equal(recommendation.status, 'insufficient_evidence');
  assert.equal(recommendation.recommendedModelId, null);
  assert.match(recommendation.reason, /no valid wall-clock latency/i);
});

test('insufficient evidence, absent category, and absent completed history never guess', () => {
  const limited = run([
    result({ modelId: 'baseline', benchmarkId: 'base-1', passed: true }),
    result({ modelId: 'candidate', benchmarkId: 'candidate-1', passed: true }),
  ]);
  const tooFew = recommendModel(input(limited));
  assert.equal(tooFew.status, 'insufficient_evidence');
  assert.match(tooFew.reason, /has 1 valid evaluated case/);

  const missingCategory = recommendModel(input(limited, { category: 'reasoning' }));
  assert.equal(missingCategory.status, 'insufficient_evidence');
  assert.match(missingCategory.reason, /No valid evaluated cases/);

  const noHistory = recommendModel(input(null));
  assert.equal(noHistory.status, 'insufficient_evidence');
  assert.match(noHistory.reason, /completed benchmark run/);
});

test('different per-model sample sizes are reported and recommendation is reproducible', () => {
  const benchmarkRun = run([
    ...[true, true, false, false].map((passed, index) => result({ modelId: 'baseline', benchmarkId: `base-${index}`, passed })),
    ...[true, true].map((passed, index) => result({ modelId: 'candidate', benchmarkId: `candidate-${index}`, passed })),
  ]);
  const first = recommendModel(input(benchmarkRun));
  const second = recommendModel(input(benchmarkRun));
  assert.deepEqual(first, second);
  assert.equal(first.comparisonModel.evaluatedCount, 4);
  assert.equal(first.recommendedModel.evaluatedCount, 2);
  assert.equal(first.recommendedModelId, 'candidate');
});

test('latency-first uses measured median wall latency, not Ollama or generation timing', () => {
  const benchmarkRun = run([
    ...[true, true].map((passed, index) => result({ modelId: 'baseline', benchmarkId: `base-${index}`, passed, latency: 250 })),
    ...[false, false].map((passed, index) => result({ modelId: 'candidate', benchmarkId: `candidate-${index}`, passed, latency: 100 })),
  ]);
  for (const record of benchmarkRun.results) {
    record.ollamaTotalMs = 1;
    record.generationMs = 0.01;
  }
  const recommendation = recommendModel(input(benchmarkRun, { preference: 'latency' }));
  assert.equal(recommendation.recommendedModelId, 'candidate');
  assert.equal(recommendation.recommendedModel.medianWallLatencyMs, 100);
});

test('correctness-first ties use stable model IDs when latency is missing', () => {
  const benchmarkRun = run([
    result({ modelId: 'baseline', benchmarkId: 'base-1', passed: true, latency: null }),
    result({ modelId: 'baseline', benchmarkId: 'base-2', passed: false, latency: null }),
    result({ modelId: 'zeta-model', benchmarkId: 'zeta-1', passed: true, latency: null }),
    result({ modelId: 'zeta-model', benchmarkId: 'zeta-2', passed: false, latency: null }),
    result({ modelId: 'alpha-model', benchmarkId: 'alpha-1', passed: true, latency: null }),
    result({ modelId: 'alpha-model', benchmarkId: 'alpha-2', passed: false, latency: null }),
  ], ['baseline', 'zeta-model', 'alpha-model']);
  assert.equal(recommendModel(input(benchmarkRun)).recommendedModelId, 'alpha-model');
});