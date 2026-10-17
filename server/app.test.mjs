import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from './app.mjs';
import { BenchmarkRunStore } from './benchmark-run-store.mjs';

async function serve(t, handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}
async function setup(t, { failureModel = null, slowModels = [], now, responses = {}, responseFactory, omitFields = {}, streamingModels = [], logger = { info() {} }, enableInferenceLogging = false, benchmarkStorePath } = {}) {
  const calls = [];
  let testStorePath = benchmarkStorePath;
  if (!testStorePath) {
    const testStoreDirectory = await mkdtemp(path.join(os.tmpdir(), 'blendlab-api-test-'));
    t.after(() => rm(testStoreDirectory, { recursive: true, force: true }));
    testStorePath = path.join(testStoreDirectory, 'runs.json');
  }
  const ollamaUrl = await serve(t, async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'a' }, { name: 'b' }] }));
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw); calls.push(body);
    if (slowModels.includes(body.model)) return;
    if (failureModel === body.model) { res.statusCode = 500; return res.end(JSON.stringify({ error: 'Model failed to load' })); }
    if (streamingModels.includes(body.model)) {
      res.setHeader('Content-Type', 'application/x-ndjson');
      const chunks = [
        { model: body.model, message: { role: 'assistant', content: 'first ' }, done: false },
        { model: body.model, message: { role: 'assistant', content: 'last' }, done: false },
        {
          model: body.model, message: { role: 'assistant', content: '' }, done: true,
          eval_count: 5, eval_duration: 2.5e9, prompt_eval_count: 7,
          prompt_eval_duration: 4e8, total_duration: 3e9, load_duration: 1e8,
        },
      ];
      return res.end(chunks.map(chunk => JSON.stringify(chunk)).join('\n') + '\n');
    }
    const ollamaData = {
      model: body.model, done: true, message: { content: `Real transport: ${body.model}` },
      eval_count: 12, eval_duration: 2e9, prompt_eval_count: 4, total_duration: 4e9,
      prompt_eval_duration: 1e8, load_duration: 3e8, ...responses[body.model],
    };
    for (const field of omitFields[body.model] || []) delete ollamaData[field];
    res.end(JSON.stringify({ ...ollamaData, ...(responseFactory?.(body) || {}) }));
  });
  const url = await serve(t, createApp({ ollamaUrl, logger, enableInferenceLogging, benchmarkStorePath: testStorePath, ...(now ? { now } : {}) }));
  return { url, calls, ollamaUrl };
}
const payload = { prompt: 'Hello', modelA: 'a', modelB: 'b', ratioB: 75, maxTokens: 32 };
const compare = (url, body) => fetch(url + '/api/ollama/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const startBenchmarkRun = (url, body) => fetch(url + '/api/ollama/benchmark-runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const requestBlendPilotRecommendation = (url, body) => fetch(url + '/api/ollama/blendpilot/recommendation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
async function waitForBenchmarkRun(url, runId) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const response = await fetch(`${url}/api/ollama/benchmark-runs/${runId}`);
    const run = await response.json();
    if (run.status !== 'running') return run;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Benchmark run ${runId} did not finish.`);
}

test('discovers models and compares via HTTP with measured telemetry and forwarded options', async t => {
  const moments = [10, 22.5, 100, 125.75];
  const { url, calls } = await setup(t, {
    now: () => moments.shift(),
    responses: { b: { eval_count: 15, eval_duration: 3e9, prompt_eval_count: 8, total_duration: 6e9 } },
  });
  assert.equal((await (await fetch(url + '/api/ollama/models')).json()).models.length, 2);
  const response = await compare(url, payload);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.sourceA.text, 'Real transport: a');
  assert.equal(data.sourceB.text, 'Real transport: b');
  assert.equal(data.sourceA.inputTokens, 4);
  assert.equal(data.sourceA.outputTokens, 12);
  assert.equal(data.sourceB.inputTokens, 8);
  assert.equal(data.sourceB.outputTokens, 15);
  assert.equal(data.sourceA.latencyMs, 12.5);
  assert.equal(data.sourceB.latencyMs, 25.75);
  assert.equal(data.sourceA.ollamaTotalMs, 4000);
  assert.equal(data.sourceB.ollamaTotalMs, 6000);
  assert.equal(data.sourceA.generationMs, 2000);
  assert.equal(data.sourceB.generationMs, 3000);
  assert.equal(data.sourceA.promptProcessingMs, 100);
  assert.equal(data.sourceB.promptProcessingMs, 100);
  assert.equal(data.sourceA.loadMs, 300);
  assert.equal(data.sourceB.loadMs, 300);
  assert.equal(data.candidate.modelName, 'b');
  assert.equal(data.candidate.provenance, 'routed');
  assert.equal(data.candidate.routedFrom, 'sourceB');
  assert.equal(data.candidate.roleName, 'Routed entirely to B at 75% · no weight merge');
  assert.equal(data.candidate.outputTokens, 15);
  assert.equal(data.candidate.generationMs, data.sourceB.generationMs);
  assert.equal(data.candidate.ollamaTotalMs, data.sourceB.ollamaTotalMs);
  assert.equal(data.candidate.measurementSource, 'sourceB');
  assert.equal(data.sourceA.tokPerSec, 6);
  assert.equal(data.sourceB.tokPerSec, 5);
  assert.deepEqual(calls.map(call => call.model), ['a', 'b']);
  assert.deepEqual(calls[0].options, { temperature: 0.7, top_p: 0.9, num_predict: 32 });
  assert.equal(calls[0].stream, false);
});
test('streaming responses aggregate text and use metadata from the final chunk', async t => {
  const { url } = await setup(t, { streamingModels: ['a'] });
  const data = await (await compare(url, payload)).json();
  assert.equal(data.sourceA.text, 'first last');
  assert.equal(data.sourceA.inputTokens, 7);
  assert.equal(data.sourceA.outputTokens, 5);
  assert.equal(data.sourceA.generationMs, 2500);
  assert.equal(data.sourceA.promptProcessingMs, 400);
  assert.equal(data.sourceA.ollamaTotalMs, 3000);
  assert.equal(data.sourceA.loadMs, 100);
  assert.equal(data.sourceA.tokPerSec, 2);
});
test('development logs uniquely identify each submitted model and its own Ollama metrics', async t => {
  const logs = [];
  const { url } = await setup(t, {
    enableInferenceLogging: true,
    logger: { info: line => logs.push(JSON.parse(line.replace('[BlendLab inference] ', ''))) },
    responses: { b: { eval_count: 15, eval_duration: 3e9, prompt_eval_count: 8, total_duration: 6e9 } },
  });
  await compare(url, payload);
  const completed = logs.filter(record => record.event === 'ollama_inference_complete');
  assert.equal(completed.length, 2);
  assert.deepEqual(completed.map(record => record.slot), ['sourceA', 'sourceB']);
  assert.notEqual(completed[0].requestId, completed[1].requestId);
  assert.deepEqual(completed.map(record => record.selectedModelId), ['a', 'b']);
  assert.deepEqual(completed.map(record => record.actualSubmittedModelId), ['a', 'b']);
  assert.deepEqual(completed.map(record => record.ollamaReportedModelId), ['a', 'b']);
  assert.deepEqual(completed.map(record => record.httpStatus), [200, 200]);
  assert.deepEqual(completed.map(record => record.promptTokenCount), [4, 8]);
  assert.deepEqual(completed.map(record => record.generatedTokenCount), [12, 15]);
  assert.deepEqual(completed.map(record => record.ollamaGenerationDurationNs), [2e9, 3e9]);
  assert.deepEqual(completed.map(record => record.ollamaTotalDurationNs), [4e9, 6e9]);
  assert.ok(completed.every(record => Date.parse(record.endTimestamp) >= Date.parse(record.startTimestamp)));
  const routed = logs.find(record => record.event === 'candidate_routed');
  assert.equal(routed.routedFrom, 'sourceB');
  assert.equal(routed.actualSubmittedModelId, null);
});
test('same model is generated once and midpoint routes to A', async t => {
  const { url, calls } = await setup(t);
  const data = await (await compare(url, { ...payload, modelB: 'a', ratioB: 50 })).json();
  assert.equal(calls.length, 1);
  assert.equal(data.candidate.modelName, 'a');
  assert.equal(data.sourceB.provenance, 'reused');
  assert.equal(data.sourceB.reusedFrom, 'sourceA');
  assert.equal(data.candidate.routedFrom, 'sourceA');
});
test('candidate routing uses A through 50% and B above 50%', async t => {
  const { url } = await setup(t);
  for (const [ratioB, expectedSource] of [[0, 'sourceA'], [50, 'sourceA'], [51, 'sourceB'], [100, 'sourceB']]) {
    const data = await (await compare(url, { ...payload, ratioB })).json();
    assert.equal(data.candidate.routedFrom, expectedSource);
    assert.equal(data.candidate.provenance, 'routed');
  }
});
test('missing Ollama token and duration metadata remains unavailable', async t => {
  const { url } = await setup(t, {
    responses: { a: { eval_count: null, eval_duration: null, prompt_eval_count: null, prompt_eval_duration: null, load_duration: null, total_duration: null } },
  });
  const data = await (await compare(url, payload)).json();
  assert.equal(data.sourceA.inputTokens, null);
  assert.equal(data.sourceA.outputTokens, null);
  assert.equal(data.sourceA.tokPerSec, null);
  assert.equal(data.sourceA.generationMs, null);
  assert.equal(data.sourceA.ollamaTotalMs, null);
  assert.equal(data.sourceA.promptProcessingMs, null);
  assert.equal(data.sourceA.loadMs, null);
});
test('Gemma-style response without eval_duration keeps counts and total time but no generation metric', async t => {
  const logs = [];
  const { url, calls } = await setup(t, {
    enableInferenceLogging: true,
    logger: { info: line => logs.push(JSON.parse(line.replace('[BlendLab inference] ', ''))) },
    responses: {
      a: {
        model: 'gemma4', eval_count: 64,
        prompt_eval_count: 38, prompt_eval_duration: null,
        total_duration: 1821.99e6, load_duration: null,
      },
    },
    omitFields: { a: ['eval_duration'] },
  });
  const data = await (await compare(url, { ...payload, modelA: 'a', modelB: 'a', ratioB: 75 })).json();
  assert.equal(calls.length, 1);
  assert.equal(data.sourceA.inputTokens, 38);
  assert.equal(data.sourceA.outputTokens, 64);
  assert.equal(data.sourceA.promptProcessingMs, null);
  assert.equal(data.sourceA.generationMs, null);
  assert.equal(data.sourceA.tokPerSec, null);
  assert.equal(data.sourceA.ollamaTotalMs, 1821.99);
  assert.equal(data.sourceB.provenance, 'reused');
  assert.equal(data.candidate.provenance, 'routed');
  assert.equal(data.candidate.routedFrom, 'sourceB');
  assert.equal(data.candidate.measurementSource, 'sourceA');
  assert.equal(data.candidate.generationMs, null);
  assert.equal(data.candidate.ollamaTotalMs, 1821.99);
  const inferenceLog = logs.find(record => record.event === 'ollama_inference_complete');
  assert.equal(inferenceLog.ollamaMetadata.eval_duration_present, false);
  assert.equal(inferenceLog.ollamaMetadata.eval_count, 64);
  assert.equal(inferenceLog.ollamaMetadata.prompt_eval_count, 38);
  assert.equal(inferenceLog.ollamaMetadata.total_duration, 1821.99e6);
});
test('generation duration is unavailable when count is missing or duration is zero or invalid', async t => {
  const { url } = await setup(t, {
    responses: {
      a: { eval_count: null, eval_duration: 2e9 },
      b: { eval_count: 15, eval_duration: 0 },
    },
  });
  const data = await (await compare(url, payload)).json();
  assert.equal(data.sourceA.outputTokens, null);
  assert.equal(data.sourceA.generationMs, 2000);
  assert.equal(data.sourceA.tokPerSec, null);
  assert.equal(data.sourceB.generationMs, null);
  assert.equal(data.sourceB.tokPerSec, null);
});
test('negative and nonnumeric Ollama durations are unavailable', async t => {
  const { url } = await setup(t, { responses: { a: { eval_duration: -1 }, b: { eval_duration: '2000000000' } } });
  const data = await (await compare(url, payload)).json();
  assert.equal(data.sourceA.generationMs, null);
  assert.equal(data.sourceB.generationMs, null);
  assert.equal(data.sourceA.tokPerSec, null);
  assert.equal(data.sourceB.tokPerSec, null);
});
test('rejects missing models and invalid settings before inference', async t => {
  const { url, calls } = await setup(t);
  assert.equal((await compare(url, { ...payload, modelB: 'missing' })).status, 400);
  assert.equal((await compare(url, { ...payload, maxTokens: -1 })).status, 400);
  assert.equal(calls.length, 0);
});
test('inference errors stay on the failed panel without fabricated metrics', async t => {
  const { url } = await setup(t, { failureModel: 'a' });
  const response = await compare(url, payload);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.sourceA.status, 'error');
  assert.match(data.sourceA.error, /failed to load/);
  assert.equal(data.sourceA.outputTokens, null);
  assert.equal(data.sourceA.tokPerSec, null);
  assert.equal(data.sourceB.status, 'success');
  assert.equal(data.candidate.modelName, 'b');
});
test('unreachable Ollama returns an actionable error', async t => {
  const url = await serve(t, createApp({ fetchImpl: async () => { throw new TypeError('fetch failed'); } }));
  const response = await fetch(url + '/api/ollama/models');
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /ollama serve/);
});

test('timeout aborts each pending inference and returns unavailable telemetry', async t => {
  const url = await serve(t, createApp({ enableInferenceLogging: false, fetchImpl: async (_url, options) => {
    if (String(_url).endsWith('/api/tags')) return Response.json({ models: [{ name: 'a' }, { name: 'b' }] });
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
  } }));
  const response = await compare(url, { ...payload, timeoutSeconds: 1 });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.sourceA.status, 'error');
  assert.match(data.sourceA.error, /timed out/);
  assert.equal(data.sourceB.status, 'error');
  assert.ok(data.sourceB.latencyMs >= 0);
  assert.equal(data.candidate.tokPerSec, null);
});

test('empty model catalog is returned without inventing models', async t => {
  const url = await serve(t, createApp({ fetchImpl: async () => Response.json({ models: [] }) }));
  assert.deepEqual(await (await fetch(url + '/api/ollama/models')).json(), { models: [] });
  assert.equal((await compare(url, payload)).status, 400);
});

test('benchmark runner independently executes each model/benchmark pair and persists associated results', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'blendlab-run-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const benchmarkStorePath = path.join(directory, 'runs.json');
  const { url, calls, ollamaUrl } = await setup(t, {
    benchmarkStorePath,
    responseFactory: body => {
      const isAddition = body.messages[0].content.includes('19 + 23');
      const isColor = body.messages[0].content.includes('uppercase word BLUE');
      return {
        model: body.model,
        message: { content: body.model === 'a'
          ? isAddition ? '42' : isColor ? 'BLUE' : 'wrong'
          : isAddition ? '43' : isColor ? 'BLUE' : 'wrong' },
        eval_count: body.model === 'a' ? 2 : 4,
        eval_duration: body.model === 'a' ? 1e9 : 2e9,
        prompt_eval_count: body.model === 'a' ? 7 : 9,
        total_duration: body.model === 'a' ? 2e9 : 3e9,
      };
    },
  });
  const response = await startBenchmarkRun(url, {
    modelIds: ['a', 'b'], benchmarkIds: ['arithmetic-addition', 'instruction-exact-color'],
  });
  assert.equal(response.status, 202);
  const accepted = await response.json();
  const run = await waitForBenchmarkRun(url, accepted.runId);
  assert.equal(run.status, 'completed');
  assert.equal(run.progress.completed, 4);
  assert.deepEqual(calls.map(call => call.model), ['a', 'a', 'b', 'b']);
  assert.equal(run.results.length, 4);
  assert.equal(new Set(run.results.map(result => result.resultId)).size, 4);
  assert.ok(run.results.every(result => result.runId === run.runId));
  assert.deepEqual(run.results.map(result => [result.modelId, result.benchmarkId]), [
    ['a', 'arithmetic-addition'], ['a', 'instruction-exact-color'],
    ['b', 'arithmetic-addition'], ['b', 'instruction-exact-color'],
  ]);
  assert.deepEqual(run.results.map(result => result.score), [1, 1, 0, 1]);
  assert.deepEqual(run.results.map(result => result.inputTokens), [7, 7, 9, 9]);
  assert.deepEqual(run.results.map(result => result.outputTokens), [2, 2, 4, 4]);
  assert.deepEqual(run.results.map(result => result.tokPerSec), [2, 2, 2, 2]);
  assert.ok(run.results.every(result => Date.parse(result.completedAt) >= Date.parse(result.startedAt)));

  const restartedApi = await serve(t, createApp({ ollamaUrl, benchmarkStorePath }));
  const persisted = await (await fetch(`${restartedApi}/api/ollama/benchmark-runs/${run.runId}`)).json();
  assert.deepEqual(persisted, run);
  assert.equal((await (await fetch(`${restartedApi}/api/ollama/benchmark-runs`)).json()).runs[0].runId, run.runId);

  const secondAccepted = await (await startBenchmarkRun(url, {
    modelIds: ['a'], benchmarkIds: ['arithmetic-addition'],
  })).json();
  const secondRun = await waitForBenchmarkRun(url, secondAccepted.runId);
  assert.notEqual(secondRun.runId, run.runId);
  assert.notEqual(secondRun.results[0].resultId, run.results[0].resultId);
});

test('benchmark runner records per-pair failures and continues later cases', async t => {
  const { url, calls } = await setup(t, { failureModel: 'b' });
  const response = await startBenchmarkRun(url, {
    modelIds: ['a', 'b'], benchmarkIds: ['arithmetic-addition', 'instruction-exact-color'],
  });
  const run = await waitForBenchmarkRun(url, (await response.json()).runId);
  assert.equal(run.status, 'completed');
  assert.deepEqual(calls.map(call => call.model), ['a', 'a', 'b', 'b']);
  assert.deepEqual(run.results.map(result => result.status), ['success', 'success', 'failed', 'failed']);
  assert.deepEqual(run.results.slice(2).map(result => result.evaluationStatus), ['not_evaluated', 'not_evaluated']);
  assert.deepEqual(run.results.slice(2).map(result => result.score), [null, null]);
  assert.ok(run.results.slice(2).every(result => result.error));
});

test('benchmark runner continues to the next prompt after one inference returns no completed response', async t => {
  const { url, calls } = await setup(t, {
    responseFactory: body => body.messages[0].content.includes('19 + 23')
      ? { done: false, message: { content: '' } }
      : { message: { content: 'BLUE' } },
  });
  const response = await startBenchmarkRun(url, {
    modelIds: ['a'], benchmarkIds: ['arithmetic-addition', 'instruction-exact-color'],
  });
  const run = await waitForBenchmarkRun(url, (await response.json()).runId);
  assert.equal(run.status, 'completed');
  assert.deepEqual(calls.map(call => call.model), ['a', 'a']);
  assert.deepEqual(run.results.map(result => result.status), ['failed', 'success']);
  assert.deepEqual(run.results.map(result => result.score), [null, 1]);
});

test('benchmark runner records timeout and unavailable measurements without fake scores', async t => {
  const { url } = await setup(t, { slowModels: ['a'] });
  const response = await startBenchmarkRun(url, {
    modelIds: ['a'], benchmarkIds: ['arithmetic-addition'], settings: { timeoutSeconds: 1 },
  });
  const run = await waitForBenchmarkRun(url, (await response.json()).runId);
  assert.equal(run.status, 'completed');
  assert.equal(run.results[0].status, 'timeout');
  assert.equal(run.results[0].evaluationStatus, 'not_evaluated');
  assert.equal(run.results[0].score, null);
  assert.equal(run.results[0].inputTokens, null);
  assert.equal(run.results[0].generationMs, null);
});

test('benchmark runner preserves token counts but leaves missing duration metrics unavailable', async t => {
  const { url } = await setup(t, {
    responses: { a: { eval_count: 5, prompt_eval_count: 9, total_duration: 7e8 } },
    omitFields: { a: ['eval_duration'] },
    responseFactory: () => ({ message: { content: '42' } }),
  });
  const response = await startBenchmarkRun(url, { modelIds: ['a'], benchmarkIds: ['arithmetic-addition'] });
  const run = await waitForBenchmarkRun(url, (await response.json()).runId);
  const result = run.results[0];
  assert.equal(result.status, 'success');
  assert.equal(result.inputTokens, 9);
  assert.equal(result.outputTokens, 5);
  assert.equal(result.ollamaTotalMs, 700);
  assert.equal(result.generationMs, null);
  assert.equal(result.tokPerSec, null);
  assert.equal(result.score, 1);
});

test('benchmark runner rejects undiscovered models and malformed IDs before inference', async t => {
  const { url, calls } = await setup(t);
  assert.equal((await startBenchmarkRun(url, { modelIds: ['missing'], benchmarkIds: ['arithmetic-addition'] })).status, 400);
  assert.equal((await startBenchmarkRun(url, { modelIds: ['a'], benchmarkIds: ['unknown'] })).status, 400);
  assert.equal((await startBenchmarkRun(url, { modelIds: ['a', 'a'], benchmarkIds: ['arithmetic-addition'] })).status, 400);
  assert.equal((await startBenchmarkRun(url, { modelIds: ['a'], benchmarkIds: ['arithmetic-addition'], settings: { maxTokens: 0 } })).status, 400);
  assert.equal((await startBenchmarkRun(url, { modelIds: ['a'], benchmarkIds: ['arithmetic-addition'], settings: { temperature: 0, unexpected: true } })).status, 400);
  assert.equal(calls.length, 0);
});

test('a run interrupted by server restart is marked failed while retaining saved results', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'blendlab-interrupted-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const benchmarkStorePath = path.join(directory, 'runs.json');
  const savedResult = { resultId: 'result-saved', benchmarkId: 'arithmetic-addition', score: 1 };
  await new BenchmarkRunStore(benchmarkStorePath).save({
    runId: 'interrupted-run', status: 'running', modelIds: ['a'], benchmarkIds: ['arithmetic-addition'],
    settings: { temperature: 0, topP: 0.9, maxTokens: 128, timeoutSeconds: 180 },
    createdAt: '2026-10-17T10:00:00.000Z', updatedAt: '2026-10-17T10:00:01.000Z', completedAt: null,
    progress: { completed: 1, total: 2, currentModelId: 'a', currentBenchmarkId: 'second' },
    results: [savedResult], error: null,
  });
  const url = await serve(t, createApp({ benchmarkStorePath }));
  const run = await (await fetch(`${url}/api/ollama/benchmark-runs/interrupted-run`)).json();
  assert.equal(run.status, 'failed');
  assert.match(run.error, /process stopped/);
  assert.deepEqual(run.results, [savedResult]);
  assert.deepEqual(await new BenchmarkRunStore(benchmarkStorePath).get('interrupted-run'), run);
});

test('BlendPilot recommendation API is reproducible from persisted completed results without inference', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'blendlab-pilot-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const benchmarkStorePath = path.join(directory, 'runs.json');
  await new BenchmarkRunStore(benchmarkStorePath).save({
    runId: 'persisted-run', status: 'completed', modelIds: ['baseline', 'qwen2.5:3b', 'gemma4:cloud'],
    benchmarkIds: ['python-add-function', 'python-square-function'],
    settings: { temperature: 0, topP: 0.9, maxTokens: 128, timeoutSeconds: 180 },
    createdAt: '2026-10-17T10:00:00.000Z', updatedAt: '2026-10-17T10:01:00.000Z', completedAt: '2026-10-17T10:01:00.000Z',
    progress: { completed: 6, total: 6, currentModelId: null, currentBenchmarkId: null },
    results: [
      { resultId: 'b1', runId: 'persisted-run', modelId: 'baseline', benchmarkId: 'python-add-function', category: 'code', status: 'success', evaluationStatus: 'evaluated', passed: true, score: 1, maxScore: 1, wallClockLatencyMs: 200, inputTokens: 8, outputTokens: 4 },
      { resultId: 'b2', runId: 'persisted-run', modelId: 'baseline', benchmarkId: 'python-square-function', category: 'code', status: 'success', evaluationStatus: 'evaluated', passed: false, score: 0, maxScore: 1, wallClockLatencyMs: 200, inputTokens: 8, outputTokens: 4 },
      { resultId: 'q1', runId: 'persisted-run', modelId: 'qwen2.5:3b', benchmarkId: 'python-add-function', category: 'code', status: 'success', evaluationStatus: 'evaluated', passed: true, score: 1, maxScore: 1, wallClockLatencyMs: 300, inputTokens: 8, outputTokens: 4 },
      { resultId: 'q2', runId: 'persisted-run', modelId: 'qwen2.5:3b', benchmarkId: 'python-square-function', category: 'code', status: 'success', evaluationStatus: 'evaluated', passed: true, score: 1, maxScore: 1, wallClockLatencyMs: 500, inputTokens: 8, outputTokens: 4 },
      { resultId: 'g1', runId: 'persisted-run', modelId: 'gemma4:cloud', benchmarkId: 'python-add-function', category: 'code', status: 'success', evaluationStatus: 'evaluated', passed: true, score: 1, maxScore: 1, wallClockLatencyMs: 80, inputTokens: 8, outputTokens: 4 },
      { resultId: 'g2', runId: 'persisted-run', modelId: 'gemma4:cloud', benchmarkId: 'python-square-function', category: 'code', status: 'success', evaluationStatus: 'evaluated', passed: false, score: 0, maxScore: 1, wallClockLatencyMs: 120, inputTokens: 8, outputTokens: 4 },
    ],
    error: null,
  });
  const { url, calls } = await setup(t, { benchmarkStorePath });
  const request = { runId: 'persisted-run', category: 'code', comparisonModelId: 'baseline', preference: 'correctness', minimumEvaluations: 2 };
  const correctness = await (await requestBlendPilotRecommendation(url, request)).json();
  const repeat = await (await requestBlendPilotRecommendation(url, request)).json();
  const latency = await (await requestBlendPilotRecommendation(url, { ...request, preference: 'latency' })).json();
  const missingCategory = await (await requestBlendPilotRecommendation(url, { ...request, category: 'json' })).json();
  assert.deepEqual(correctness, repeat);
  assert.equal(correctness.status, 'recommended');
  assert.equal(correctness.recommendedModelId, 'qwen2.5:3b');
  assert.equal(correctness.recommendedModel.passRatePercent, 100);
  assert.deepEqual(correctness.recommendedModel.benchmarkIds, ['python-add-function', 'python-square-function']);
  assert.equal(latency.recommendedModelId, 'gemma4:cloud');
  assert.equal(latency.recommendedModel.medianWallLatencyMs, 100);
  assert.equal(missingCategory.status, 'insufficient_evidence');
  assert.equal(calls.length, 0);
});

test('BlendPilot API rejects malformed settings, unknown models, and missing run IDs', async t => {
  const { url } = await setup(t);
  const base = { runId: 'missing', category: 'code', comparisonModelId: 'a', preference: 'correctness', minimumEvaluations: 2 };
  assert.equal((await requestBlendPilotRecommendation(url, { ...base, preference: 'speed' })).status, 400);
  assert.equal((await requestBlendPilotRecommendation(url, { ...base, minimumEvaluations: 0 })).status, 400);
  assert.equal((await requestBlendPilotRecommendation(url, { ...base, category: 'unknown' })).status, 400);
  assert.equal((await requestBlendPilotRecommendation(url, base)).status, 404);
});
