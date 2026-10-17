import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BenchmarkRunStore } from './benchmark-run-store.mjs';

test('benchmark runs persist atomically and are readable from a new store instance', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'blendlab-bench-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'runs.json');
  const initial = {
    runId: 'run-1', status: 'running', createdAt: '2026-10-17T10:00:00.000Z', results: [],
  };
  const completed = { ...initial, status: 'completed', results: [{ resultId: 'result-1', score: 1 }] };
  const store = new BenchmarkRunStore(filePath);
  await store.save(initial);
  await store.save(completed);

  const restartedStore = new BenchmarkRunStore(filePath);
  assert.deepEqual(await restartedStore.get('run-1'), completed);
  assert.deepEqual(await restartedStore.list(), [completed]);
});