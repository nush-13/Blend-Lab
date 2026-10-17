import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFailedResponses, createPendingResponses } from './playgroundState';

test('a new prompt replaces prior responses and clears all measurements', () => {
  const previous = createPendingResponses('model-a', 'model-b');
  previous.sourceA.status = 'success';
  previous.sourceA.inputTokens = 44;
  previous.sourceA.outputTokens = 18;
  previous.sourceA.latencyMs = 1260;
  previous.candidate.tokPerSec = 14.3;

  const next = createPendingResponses('model-a', 'model-b');
  assert.equal(next.sourceA.status, 'loading');
  assert.equal(next.sourceA.inputTokens, null);
  assert.equal(next.sourceA.outputTokens, null);
  assert.equal(next.sourceA.latencyMs, null);
  assert.equal(next.candidate.tokPerSec, null);
  assert.equal(next.sourceB.outputTokens, null);
});

test('transport failure creates error panels without placeholder metrics', () => {
  const failed = createFailedResponses('model-a', 'model-b', 'API unavailable');
  assert.equal(failed.sourceA.status, 'error');
  assert.equal(failed.sourceB.error, 'API unavailable');
  assert.equal(failed.candidate.outputTokens, null);
  assert.equal(failed.candidate.tokPerSec, null);
});