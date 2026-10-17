function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarizeExperiment(experiment, run) {
  const models = run.modelIds.map(modelId => {
    const results = run.results.filter(result => result.modelId === modelId);
    const evaluated = results.filter(result => result.evaluationStatus === 'evaluated' && result.passed !== null);
    const latencies = results.map(result => result.wallClockLatencyMs).filter(value => Number.isFinite(value));
    return {
      modelId, evaluatedCases: evaluated.length,
      passRate: evaluated.length ? evaluated.filter(result => result.passed).length / evaluated.length : null,
      failedInferences: results.filter(result => result.status === 'failed' || result.status === 'timeout').length,
      unavailableEvaluations: results.filter(result => result.evaluationStatus !== 'evaluated').length,
      medianWallLatencyMs: median(latencies),
    };
  });
  return { experimentId: experiment.id, runId: run.runId, status: run.status, models };
}

export function compareExperimentConfigurations(left, right) {
  const sameBenchmarks = JSON.stringify([...left.benchmarkIds].sort()) === JSON.stringify([...right.benchmarkIds].sort());
  const sameSettings = JSON.stringify(left.settings) === JSON.stringify(right.settings);
  return { comparable: sameBenchmarks && sameSettings, sameBenchmarks, sameSettings };
}
