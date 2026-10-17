import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BenchmarkRun } from '../types';
import { hasRunningBenchmarkRun, runningBenchmarkRunIds } from './benchmarkRunState';

function run(runId: string, status: BenchmarkRun['status']): BenchmarkRun {
  return {
    runId, status, modelIds: [], benchmarkIds: [],
    settings: { temperature: 0, topP: 0.9, maxTokens: 128, timeoutSeconds: 180 },
    createdAt: '', updatedAt: '', completedAt: null,
    progress: { completed: 0, total: 0, currentModelId: null, currentBenchmarkId: null },
    results: [], error: null,
  };
}

test('running status is tracked across saved runs, not only the selected run', () => {
  const runs = [run('completed', 'completed'), run('in-flight', 'running'), run('failed', 'failed')];
  assert.deepEqual(runningBenchmarkRunIds(runs), ['in-flight']);
  assert.equal(hasRunningBenchmarkRun(runs), true);
  assert.equal(hasRunningBenchmarkRun([runs[0], runs[2]]), false);
});
