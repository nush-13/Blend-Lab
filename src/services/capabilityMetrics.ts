import { BenchmarkRun, BenchmarkRunResult } from '../types';

export interface CapabilityCategoryMetrics {
  modelId: string;
  category: BenchmarkRunResult['category'];
  evaluatedCount: number;
  passedCount: number;
  passRatePercent: number | null;
  inferenceFailedCount: number;
  evaluationUnavailableCount: number;
  latencySampleCount: number;
  medianWallLatencyMs: number | null;
}

export interface CapabilityModelSummary {
  modelId: string;
  evaluatedCount: number;
  passedCount: number;
  passRatePercent: number | null;
  inferenceFailedCount: number;
  evaluationUnavailableCount: number;
  latencySampleCount: number;
  medianWallLatencyMs: number | null;
}

export interface CapabilityModelComparison {
  comparable: boolean;
  configurationShared: boolean;
  reason: 'select-two-models' | 'model-not-in-run' | 'case-coverage-differs' | null;
  casesByModel: Array<{ modelId: string; caseIds: string[]; missingCaseIds: string[]; extraCaseIds: string[] }>;
}

export function selectCompletedBenchmarkRuns(runs: BenchmarkRun[]): BenchmarkRun[] {
  return runs.filter(run => run.status === 'completed');
}

export function selectCapabilityRun(runs: BenchmarkRun[], runId: string): BenchmarkRun | null {
  const completed = selectCompletedBenchmarkRuns(runs);
  return completed.find(run => run.runId === runId) || completed[0] || null;
}

export function validateCapabilityModelComparison(run: BenchmarkRun, modelIds: string[]): CapabilityModelComparison {
  if (modelIds.length < 2 || new Set(modelIds).size !== modelIds.length) {
    return { comparable: false, configurationShared: true, reason: 'select-two-models', casesByModel: [] };
  }
  if (modelIds.some(modelId => !run.modelIds.includes(modelId))) {
    return { comparable: false, configurationShared: true, reason: 'model-not-in-run', casesByModel: [] };
  }
  const expected = new Set(run.benchmarkIds);
  const casesByModel = modelIds.map(modelId => {
    const actual = new Set(run.results.filter(result => result.modelId === modelId).map(result => result.benchmarkId));
    return {
      modelId,
      caseIds: [...actual].sort(),
      missingCaseIds: [...expected].filter(id => !actual.has(id)).sort(),
      extraCaseIds: [...actual].filter(id => !expected.has(id)).sort(),
    };
  });
  const completeCoverage = casesByModel.every(item => item.missingCaseIds.length === 0 && item.extraCaseIds.length === 0);
  return {
    comparable: completeCoverage,
    configurationShared: true,
    reason: completeCoverage ? null : 'case-coverage-differs',
    casesByModel,
  };
}

function hasValidEvaluation(result: BenchmarkRunResult): boolean {
  return result.status === 'success' && result.evaluationStatus === 'evaluated' &&
    typeof result.passed === 'boolean' && Number.isFinite(result.score) && result.score !== null &&
    Number.isFinite(result.maxScore) && result.maxScore > 0 && result.score >= 0 && result.score <= result.maxScore;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function aggregateCapabilityRun(run: BenchmarkRun | null): CapabilityCategoryMetrics[] {
  if (!run || run.status !== 'completed') return [];
  const aggregates = new Map<string, {
    modelId: string;
    category: BenchmarkRunResult['category'];
    evaluatedCount: number;
    passedCount: number;
    inferenceFailedCount: number;
    evaluationUnavailableCount: number;
    latencies: number[];
  }>();

  for (const result of run.results) {
    const key = `${result.modelId}\0${result.category}`;
    let aggregate = aggregates.get(key);
    if (!aggregate) {
      aggregate = {
        modelId: result.modelId, category: result.category,
        evaluatedCount: 0, passedCount: 0, inferenceFailedCount: 0,
        evaluationUnavailableCount: 0, latencies: [],
      };
      aggregates.set(key, aggregate);
    }
    if (result.status === 'failed' || result.status === 'timeout') {
      aggregate.inferenceFailedCount += 1;
    } else if (hasValidEvaluation(result)) {
      aggregate.evaluatedCount += 1;
      if (result.passed) aggregate.passedCount += 1;
    } else {
      aggregate.evaluationUnavailableCount += 1;
    }
    if (Number.isFinite(result.wallClockLatencyMs) && result.wallClockLatencyMs !== null && result.wallClockLatencyMs >= 0) {
      aggregate.latencies.push(result.wallClockLatencyMs);
    }
  }

  return [...aggregates.values()].map(aggregate => ({
    modelId: aggregate.modelId,
    category: aggregate.category,
    evaluatedCount: aggregate.evaluatedCount,
    passedCount: aggregate.passedCount,
    passRatePercent: aggregate.evaluatedCount
      ? Number((aggregate.passedCount / aggregate.evaluatedCount * 100).toFixed(1))
      : null,
    inferenceFailedCount: aggregate.inferenceFailedCount,
    evaluationUnavailableCount: aggregate.evaluationUnavailableCount,
    latencySampleCount: aggregate.latencies.length,
    medianWallLatencyMs: median(aggregate.latencies),
  }));
}

export function summarizeCapabilityModel(run: BenchmarkRun, modelId: string): CapabilityModelSummary {
  const results = run.results.filter(result => result.modelId === modelId);
  const evaluated = results.filter(hasValidEvaluation);
  const latencies = results
    .filter(result => Number.isFinite(result.wallClockLatencyMs) && result.wallClockLatencyMs !== null && result.wallClockLatencyMs >= 0)
    .map(result => result.wallClockLatencyMs as number);
  const passedCount = evaluated.filter(result => result.passed).length;
  return {
    modelId,
    evaluatedCount: evaluated.length,
    passedCount,
    passRatePercent: evaluated.length ? Number((passedCount / evaluated.length * 100).toFixed(1)) : null,
    inferenceFailedCount: results.filter(result => result.status === 'failed' || result.status === 'timeout').length,
    evaluationUnavailableCount: results.filter(result => result.status === 'success' && !hasValidEvaluation(result)).length,
    latencySampleCount: latencies.length,
    medianWallLatencyMs: median(latencies),
  };
}
