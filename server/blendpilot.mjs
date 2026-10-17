function hasValidEvaluation(result) {
  return result.status === 'success' && result.evaluationStatus === 'evaluated' &&
    typeof result.passed === 'boolean' && Number.isFinite(result.score) &&
    Number.isFinite(result.maxScore) && result.maxScore > 0 &&
    result.score >= 0 && result.score <= result.maxScore;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function summarizeModel(run, category, modelId) {
  const results = run.results.filter(result => result.category === category && result.modelId === modelId);
  const evaluations = results.filter(hasValidEvaluation);
  const latencyResults = results.filter(result => result.status === 'success' &&
    Number.isFinite(result.wallClockLatencyMs) && result.wallClockLatencyMs !== null && result.wallClockLatencyMs >= 0);
  const passedCount = evaluations.filter(result => result.passed).length;
  return {
    modelId,
    evaluatedCount: evaluations.length,
    passedCount,
    passRatePercent: evaluations.length ? Number((passedCount / evaluations.length * 100).toFixed(1)) : null,
    inferenceFailedCount: results.filter(result => result.status === 'failed' || result.status === 'timeout').length,
    unavailableEvaluationCount: results.filter(result => result.status === 'success' && !hasValidEvaluation(result)).length,
    medianWallLatencyMs: median(latencyResults.map(result => result.wallClockLatencyMs)),
    latencySampleCount: latencyResults.length,
    benchmarkIds: [...new Set(evaluations.map(result => result.benchmarkId))].sort(),
  };
}

function insufficient({ runId, category, comparisonModelId, preference, minimumEvaluations, reason, summaries = [] }) {
  return {
    status: 'insufficient_evidence', runId, category, comparisonModelId,
    preference, minimumEvaluations, recommendedModelId: null,
    comparisonModel: summaries.find(summary => summary.modelId === comparisonModelId) || null,
    recommendedModel: null, candidates: summaries, reason,
  };
}

export function recommendModel({ run, category, comparisonModelId, preference, minimumEvaluations }) {
  if (!run || run.status !== 'completed') {
    return insufficient({ runId: run?.runId || null, category, comparisonModelId, preference, minimumEvaluations, reason: 'Select a completed benchmark run.' });
  }
  if (!run.modelIds.includes(comparisonModelId)) {
    return insufficient({ runId: run.runId, category, comparisonModelId, preference, minimumEvaluations, reason: 'The comparison model is not part of this benchmark run.' });
  }

  const summaries = run.modelIds.map(modelId => summarizeModel(run, category, modelId));
  const baseline = summaries.find(summary => summary.modelId === comparisonModelId);
  if (!baseline || !baseline.evaluatedCount) {
    return insufficient({ runId: run.runId, category, comparisonModelId, preference, minimumEvaluations, reason: `No valid evaluated cases exist for ${category} in this run.`, summaries });
  }
  if (baseline.evaluatedCount < minimumEvaluations) {
    return insufficient({ runId: run.runId, category, comparisonModelId, preference, minimumEvaluations, reason: `${comparisonModelId} has ${baseline.evaluatedCount} valid evaluated case(s); ${minimumEvaluations} are required.`, summaries });
  }
  if (preference === 'latency' && baseline.medianWallLatencyMs === null) {
    return insufficient({ runId: run.runId, category, comparisonModelId, preference, minimumEvaluations, reason: `${comparisonModelId} has no valid wall-clock latency measurements for ${category}.`, summaries });
  }

  const alternatives = summaries.filter(summary => summary.modelId !== comparisonModelId);
  const eligible = alternatives.filter(summary => summary.evaluatedCount >= minimumEvaluations &&
    (preference !== 'latency' || summary.medianWallLatencyMs !== null));
  if (!eligible.length) {
    const qualifiedAlternatives = alternatives.length;
    const reason = !qualifiedAlternatives
      ? 'The selected run contains no alternative model to compare.'
      : preference === 'latency'
        ? `No alternative model has at least ${minimumEvaluations} valid evaluations and measured wall latency for ${category}.`
        : `No alternative model has at least ${minimumEvaluations} valid evaluations for ${category}.`;
    return insufficient({ runId: run.runId, category, comparisonModelId, preference, minimumEvaluations, reason, summaries });
  }

  eligible.sort((left, right) => {
    if (preference === 'latency') {
      return left.medianWallLatencyMs - right.medianWallLatencyMs ||
        right.passRatePercent - left.passRatePercent || left.modelId.localeCompare(right.modelId);
    }
    return right.passRatePercent - left.passRatePercent || left.modelId.localeCompare(right.modelId);
  });

  const recommended = eligible[0];
  const evidence = `Based on ${recommended.evaluatedCount} valid ${category} evaluation(s) (${recommended.passedCount} passed; cases: ${recommended.benchmarkIds.join(', ')}), compared with ${comparisonModelId} at ${baseline.passedCount}/${baseline.evaluatedCount}.`;
  return {
    status: 'recommended', runId: run.runId, category, comparisonModelId,
    preference, minimumEvaluations, recommendedModelId: recommended.modelId,
    comparisonModel: baseline, recommendedModel: recommended,
    candidates: summaries, reason: evidence,
  };
}