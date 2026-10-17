import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
const server = createApp().listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
try {
  const base = `http://127.0.0.1:${server.address().port}/api/ollama`;
  const tags = await (await fetch(base + '/models')).json();
  assert.ok(tags.models?.length, tags.error || 'No installed Ollama models');
  const model = process.env.OLLAMA_TEST_MODEL || tags.models[0].name;
  const response = await fetch(base + '/compare', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelA: model, modelB: model, prompt: 'Reply with exactly: OLLAMA_OK', maxTokens: 32, temperature: 0, timeoutSeconds: 180 }),
  });
  const data = await response.json();
  assert.equal(response.status, 200, data.error);
  assert.match(data.sourceA.text, /OLLAMA_OK/);
  assert.ok(data.sourceA.tokens > 0);
  assert.ok(data.sourceA.tokPerSec > 0);
  assert.equal(data.sourceA.text, data.sourceB.text);
  console.log(JSON.stringify({ model, text: data.sourceA.text, tokens: data.sourceA.tokens, tokPerSec: data.sourceA.tokPerSec, latencyMs: data.sourceA.latencyMs }, null, 2));
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
