import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Experiment } from '../types';
import { configurationForRerun, formatRecordedMetric, initialExperimentModels, toggleSelectedId } from './experimentForm';

const experiment: Experiment = {
  id: 'saved-1', name: 'Arithmetic', description: 'Repeat this check', createdAt: '2026-10-17T10:00:00.000Z',
  runId: 'run-1', modelIds: ['model-a'], benchmarkIds: ['arithmetic-addition'],
  settings: { temperature: 0, topP: 0.9, maxTokens: 128, timeoutSeconds: 180 }, runStatus: 'completed',
};

test('loading experiment configuration creates a fresh rerun config without mutating saved data', () => {
  const loaded = configurationForRerun(experiment);
  assert.equal(loaded.name, 'Arithmetic rerun');
  assert.deepEqual(loaded.modelIds, experiment.modelIds);
  assert.deepEqual(loaded.benchmarkIds, experiment.benchmarkIds);
  assert.deepEqual(loaded.settings, experiment.settings);
  loaded.modelIds.push('model-b');
  assert.deepEqual(experiment.modelIds, ['model-a']);
});

test('model and case selection toggles ids and missing metrics stay explicit', () => {
  assert.deepEqual(toggleSelectedId(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggleSelectedId(['a', 'b'], 'a'), ['b']);
  assert.equal(formatRecordedMetric(null, ' ms'), 'Unavailable');
  assert.equal(formatRecordedMetric(12, ' ms'), '12 ms');
});

test('initial model defaults are derived only from the available catalog', () => {
  assert.deepEqual(initialExperimentModels([]), []);
  assert.deepEqual(initialExperimentModels(['a', 'b', 'c']), ['a', 'b']);
});
