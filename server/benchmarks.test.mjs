import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BENCHMARKS, evaluateBenchmark, getBenchmarks, hasBenchmark } from './benchmarks.mjs';

test('benchmark catalog contains stable unique IDs and deterministic scoring criteria', () => {
  const ids = BENCHMARKS.map(benchmark => benchmark.id);
  assert.equal(BENCHMARKS.length, 11);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(BENCHMARKS.every(benchmark => benchmark.prompt && benchmark.criteria && benchmark.scoringMethod));
  assert.ok(hasBenchmark('arithmetic-addition'));
  assert.deepEqual(getBenchmarks(['arithmetic-addition', 'unknown']).map(item => item.id), ['arithmetic-addition']);
});

test('exact, fragment, and JSON checks produce binary scores only for their defined checks', () => {
  const arithmetic = getBenchmarks(['arithmetic-addition'])[0];
  assert.deepEqual(evaluateBenchmark(arithmetic, ' 42\n'), {
    status: 'evaluated', passed: true, score: 1, maxScore: 1, scoringMethod: 'exact-normalized',
  });
  assert.equal(evaluateBenchmark(arithmetic, 'The answer is 42.').score, 0);

  const code = getBenchmarks(['python-add-function'])[0];
  assert.equal(evaluateBenchmark(code, 'def add(a, b):\n    return a + b').score, 1);
  assert.equal(evaluateBenchmark(code, 'def add(a, b):\n    return a - b').score, 0);

  const json = getBenchmarks(['json-status-schema'])[0];
  assert.equal(evaluateBenchmark(json, '{"retry_count":0,"id":7,"status":"ready"}').score, 1);
  assert.equal(evaluateBenchmark(json, '```json\n{"id":7,"status":"ready","retry_count":0}\n```').score, 0);
  assert.equal(evaluateBenchmark(json, '{"id":7,"status":"ready","retry_count":0,"extra":true}').score, 0);
});