import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from './app.mjs';
import { BenchmarkRunStore } from './benchmark-run-store.mjs';
import { ExperimentStore } from './experiment-store.mjs';

async function serve(t, handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}
async function setup(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'blendlab-experiments-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const benchmarkStorePath = path.join(directory, 'runs.json');
  const experimentStorePath = path.join(directory, 'experiments.json');
  const ollamaUrl = await serve(t, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'model-a' }, { name: 'model-b' }] }));
    if (req.url === '/api/chat') return res.end(JSON.stringify({ model: 'model-a', done: true, message: { content: '42' }, eval_count: 1, eval_duration: 1e9, prompt_eval_count: 1, total_duration: 2e9 }));
    res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' }));
  });
  const url = await serve(t, createApp({ ollamaUrl, benchmarkStorePath, experimentStorePath, enableInferenceLogging: false }));
  return { directory, benchmarkStorePath, experimentStorePath, ollamaUrl, url };
}
const json = (url, method, body) => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });

test('experiment creation validates run existence and persists its configuration across store restart', async t => {
  const { url, benchmarkStorePath, experimentStorePath } = await setup(t);
  const config = { runId: 'run-one', status: 'completed', modelIds: ['model-a', 'model-b'], benchmarkIds: ['arithmetic-addition'], settings: { temperature: 0, topP: 0.9, maxTokens: 128, timeoutSeconds: 180 }, createdAt: '2026-10-17T10:00:00.000Z', updatedAt: '2026-10-17T10:00:05.000Z', completedAt: '2026-10-17T10:00:05.000Z', progress: { completed: 2, total: 2, currentModelId: null, currentBenchmarkId: null }, results: [], error: null };
  await new BenchmarkRunStore(benchmarkStorePath).save(config);
  await new BenchmarkRunStore(benchmarkStorePath).save({ ...config, runId: 'still-running', status: 'running', completedAt: null });
  await new BenchmarkRunStore(benchmarkStorePath).save({ ...config, runId: 'failed-run', status: 'failed' });
  assert.equal((await json(`${url}/api/ollama/experiments`, 'POST', { name: 'Missing run', runId: 'missing' })).status, 404);
  const runningResponse = await json(`${url}/api/ollama/experiments`, 'POST', { name: 'Running run', runId: 'still-running' });
  assert.equal(runningResponse.status, 409);
  assert.match((await runningResponse.json()).error, /only completed runs/i);
  assert.equal((await json(`${url}/api/ollama/experiments`, 'POST', { name: 'Failed run', runId: 'failed-run' })).status, 409);
  const response = await json(`${url}/api/ollama/experiments`, 'POST', { name: 'Arithmetic check', description: 'A saved run', runId: 'run-one' });
  assert.equal(response.status, 201);
  const experiment = await response.json();
  assert.deepEqual(experiment.modelIds, config.modelIds);
  assert.deepEqual(experiment.benchmarkIds, config.benchmarkIds);
  assert.deepEqual(experiment.settings, config.settings);
  assert.equal(experiment.runId, 'run-one');
  const restarted = new ExperimentStore(experimentStorePath);
  assert.deepEqual(await restarted.get(experiment.id), experiment);
});

test('experiment persistence failures return an API error instead of claiming the record was saved', async t => {
  const { url, directory, benchmarkStorePath, ollamaUrl } = await setup(t);
  const run = { runId: 'persist-test', status: 'completed', modelIds: ['model-a'], benchmarkIds: ['arithmetic-addition'], settings: { temperature: 0, topP: 0.9, maxTokens: 128, timeoutSeconds: 180 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), completedAt: new Date().toISOString(), progress: { completed: 1, total: 1, currentModelId: null, currentBenchmarkId: null }, results: [], error: null };
  const runStore = new BenchmarkRunStore(benchmarkStorePath);
  await runStore.save(run);
  const brokenStoreApi = await serve(t, createApp({
    ollamaUrl,
    benchmarkStorePath,
    experimentStorePath: directory,
    enableInferenceLogging: false,
  }));
  const response = await json(`${brokenStoreApi}/api/ollama/experiments`, 'POST', { name: 'Should fail to save', runId: run.runId });
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /directory|file|rename|EISDIR/i);
});

test('experiment validation rejects malformed creation requests and missing installed models', async t => {
  const { url, benchmarkStorePath } = await setup(t);
  const run = { runId: 'bad-model', status: 'completed', modelIds: ['removed-model'], benchmarkIds: ['arithmetic-addition'], settings: { temperature: 0, topP: 0.9, maxTokens: 128, timeoutSeconds: 180 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), completedAt: new Date().toISOString(), progress: { completed: 1, total: 1, currentModelId: null, currentBenchmarkId: null }, results: [], error: null };
  const runStore = new BenchmarkRunStore(benchmarkStorePath);
  await runStore.save(run);
  await runStore.save({ ...run, runId: 'bad-config', modelIds: ['model-a'], settings: { temperature: 9 } });
  assert.equal((await json(`${url}/api/ollama/experiments`, 'POST', { name: '', runId: 'bad-model' })).status, 400);
  assert.equal((await json(`${url}/api/ollama/experiments`, 'POST', { name: 'Bad model', runId: 'bad-model' })).status, 400);
  assert.equal((await json(`${url}/api/ollama/experiments`, 'POST', { name: 'Bad config', runId: 'bad-config' })).status, 400);
});

test('comparison reports recorded outcomes, unavailable metrics, and configuration mismatch', async t => {
  const { url, benchmarkStorePath } = await setup(t);
  const runs = new BenchmarkRunStore(benchmarkStorePath);
  const results = [
    { resultId: '1', modelId: 'model-a', benchmarkId: 'arithmetic-addition', status: 'success', evaluationStatus: 'evaluated', passed: true, wallClockLatencyMs: 10 },
    { resultId: '2', modelId: 'model-a', benchmarkId: 'json-status-schema', status: 'failed', evaluationStatus: 'not_evaluated', passed: null, wallClockLatencyMs: null },
  ];
  for (const run of [
    { runId: 'run-a', status: 'completed', modelIds: ['model-a'], benchmarkIds: ['arithmetic-addition'], settings: { temperature: 0 }, results, createdAt: '2026-10-17T10:00:00.000Z' },
    { runId: 'run-b', status: 'failed', modelIds: ['model-b'], benchmarkIds: ['json-status-schema'], settings: { temperature: 0.2 }, results: [], createdAt: '2026-10-17T10:01:00.000Z' },
  ]) await runs.save(run);
  const store = new ExperimentStore(path.join(path.dirname(benchmarkStorePath), 'experiments.json'));
  const a = await store.create({ name: 'A', description: '', runId: 'run-a', modelIds: ['model-a'], benchmarkIds: ['arithmetic-addition'], settings: { temperature: 0 } });
  const b = await store.create({ name: 'B', description: '', runId: 'run-b', modelIds: ['model-b'], benchmarkIds: ['json-status-schema'], settings: { temperature: 0.2 } });
  const response = await json(`${url}/api/ollama/experiments/compare`, 'POST', { experimentIds: [a.id, b.id] });
  const comparison = await response.json();
  assert.deepEqual(comparison.configurations, { comparable: false, sameBenchmarks: false, sameSettings: false });
  assert.equal(comparison.results[0].models[0].passRate, 1);
  assert.equal(comparison.results[0].models[0].failedInferences, 1);
  assert.equal(comparison.results[0].models[0].unavailableEvaluations, 1);
  assert.equal(comparison.results[0].models[0].medianWallLatencyMs, 10);
  assert.equal(comparison.results[1].models[0].passRate, null);
  assert.equal(comparison.results[1].models[0].medianWallLatencyMs, null);
});

test('rerunning a saved configuration creates a distinct run and experiment while retaining the original', async t => {
  const { url, benchmarkStorePath, experimentStorePath } = await setup(t);
  const originalRun = { runId: 'original-run', status: 'completed', modelIds: ['model-a'], benchmarkIds: ['arithmetic-addition'], settings: { temperature: 0, topP: 0.9, maxTokens: 128, timeoutSeconds: 10 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), completedAt: new Date().toISOString(), progress: { completed: 1, total: 1, currentModelId: null, currentBenchmarkId: null }, results: [{ resultId: 'original-result', runId: 'original-run', modelId: 'model-a', benchmarkId: 'arithmetic-addition', status: 'success', evaluationStatus: 'evaluated', passed: true, score: 1, wallClockLatencyMs: 10 }], error: null };
  await new BenchmarkRunStore(benchmarkStorePath).save(originalRun);
  const originalExperiment = await (await json(`${url}/api/ollama/experiments`, 'POST', { name: 'Original', runId: 'original-run' })).json();
  const start = await json(`${url}/api/ollama/benchmark-runs`, 'POST', { modelIds: originalExperiment.modelIds, benchmarkIds: originalExperiment.benchmarkIds, settings: originalExperiment.settings });
  assert.equal(start.status, 202);
  const newRun = await start.json();
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const refreshed = await (await fetch(`${url}/api/ollama/benchmark-runs/${newRun.runId}`)).json();
    if (refreshed.status !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const rerunExperiment = await (await json(`${url}/api/ollama/experiments`, 'POST', { name: 'Original rerun', runId: newRun.runId })).json();
  assert.notEqual(rerunExperiment.id, originalExperiment.id);
  assert.notEqual(rerunExperiment.runId, originalExperiment.runId);
  const saved = await new ExperimentStore(experimentStorePath).list();
  assert.deepEqual(saved.map(item => item.id), [rerunExperiment.id, originalExperiment.id]);
  assert.deepEqual((await new BenchmarkRunStore(benchmarkStorePath).get(originalRun.runId)).results, originalRun.results);
});
