import { BenchmarkRun } from '../types';

export function runningBenchmarkRunIds(runs: BenchmarkRun[]): string[] {
  return runs.filter(run => run.status === 'running').map(run => run.runId);
}

export function hasRunningBenchmarkRun(runs: BenchmarkRun[]): boolean {
  return runningBenchmarkRunIds(runs).length > 0;
}
