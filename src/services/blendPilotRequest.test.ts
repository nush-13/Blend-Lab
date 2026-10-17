import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blendPilotRequestKey } from './blendPilotRequest';

test('recommendation identity changes when any evidence selection or priority changes', () => {
  const input = { runId: 'run-a', category: 'code', comparisonModelId: 'model-a', preference: 'correctness' as const, minimumEvaluations: 2 };
  const key = blendPilotRequestKey(input);
  assert.notEqual(key, blendPilotRequestKey({ ...input, runId: 'run-b' }));
  assert.notEqual(key, blendPilotRequestKey({ ...input, category: 'reasoning' }));
  assert.notEqual(key, blendPilotRequestKey({ ...input, comparisonModelId: 'model-b' }));
  assert.notEqual(key, blendPilotRequestKey({ ...input, preference: 'latency' }));
  assert.notEqual(key, blendPilotRequestKey({ ...input, minimumEvaluations: 3 }));
});
