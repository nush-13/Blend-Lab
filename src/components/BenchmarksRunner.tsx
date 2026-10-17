import React, { useEffect, useState } from 'react';
import { AlertCircle, Play, RefreshCw } from 'lucide-react';
import { BenchmarkDefinition, BenchmarkRun, ModelInfo } from '../types';
import { apiService } from '../services/api';
import { hasRunningBenchmarkRun, runningBenchmarkRunIds } from '../services/benchmarkRunState';

interface BenchmarksProps {
  models: ModelInfo[];
  isOllama: boolean;
  initialRunId?: string;
}

function upsertRun(runs: BenchmarkRun[], run: BenchmarkRun): BenchmarkRun[] {
  return [run, ...runs.filter(item => item.runId !== run.runId)];
}

function formatMetric(value: number | null, unit = ''): string {
  return value === null ? 'N/A' : `${value}${unit}`;
}

function formatEvaluation(result: BenchmarkRun['results'][number]): string {
  if (result.evaluationStatus !== 'evaluated' || result.score === null) return 'N/A';
  return `${result.passed ? 'PASS' : 'FAIL'} · ${result.score}/${result.maxScore}`;
}

export const Benchmarks: React.FC<BenchmarksProps> = ({ models, isOllama, initialRunId }) => {
  const [benchmarks, setBenchmarks] = useState<BenchmarkDefinition[]>([]);
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [activeRun, setActiveRun] = useState<BenchmarkRun | null>(null);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [selectedBenchmarkIds, setSelectedBenchmarkIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    Promise.all([apiService.getBenchmarkDefinitions(), apiService.getBenchmarkRuns()])
      .then(([definitions, savedRuns]) => {
        if (!current) return;
        setBenchmarks(definitions);
        setSelectedBenchmarkIds(definitions.map(item => item.id));
        setRuns(savedRuns);
        setActiveRun(savedRuns.find(run => run.runId === initialRunId) || savedRuns[0] || null);
        setError(null);
      })
      .catch(reason => {
        if (current) setError(reason instanceof Error ? reason.message : 'Could not load benchmark data.');
      })
      .finally(() => { if (current) setIsLoading(false); });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    setSelectedModelIds(current => {
      const valid = current.filter(id => models.some(model => model.id === id));
      return valid.length ? valid : models.slice(0, 2).map(model => model.id);
    });
  }, [models]);

  const runningRunIds = runningBenchmarkRunIds(runs);
  const runningRunKey = runningRunIds.join('|');

  useEffect(() => {
    if (!runningRunKey) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout>;
    const runIds = runningRunKey.split('|');
    const poll = async () => {
      try {
        const updates = await Promise.all(runIds.map(runId => apiService.getBenchmarkRun(runId)));
        if (!current) return;
        for (const updated of updates) {
          setRuns(existing => upsertRun(existing, updated));
          setActiveRun(existing => existing?.runId === updated.runId ? updated : existing);
        }
        timer = setTimeout(poll, 700);
      } catch (reason) {
        if (!current) return;
        setError(reason instanceof Error ? reason.message : 'Could not refresh benchmark progress.');
        timer = setTimeout(poll, 1500);
      }
    };
    timer = setTimeout(poll, 500);
    return () => { current = false; clearTimeout(timer); };
  }, [runningRunKey]);

  const toggleModel = (modelId: string) => {
    setSelectedModelIds(current => current.includes(modelId)
      ? current.filter(id => id !== modelId)
      : [...current, modelId]);
  };

  const toggleBenchmark = (benchmarkId: string) => {
    setSelectedBenchmarkIds(current => current.includes(benchmarkId)
      ? current.filter(id => id !== benchmarkId)
      : [...current, benchmarkId]);
  };

  const handleStart = async () => {
    if (!isOllama || !selectedModelIds.length || !selectedBenchmarkIds.length || isStarting || hasRunningBenchmarkRun(runs)) return;
    setIsStarting(true);
    setError(null);
    try {
      const run = await apiService.startBenchmarkRun({
        modelIds: selectedModelIds,
        benchmarkIds: selectedBenchmarkIds,
        settings: { temperature: 0, topP: 0.9, maxTokens: 128, timeoutSeconds: 180 },
      });
      setActiveRun(run);
      setRuns(current => upsertRun(current, run));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start benchmark run.');
    } finally {
      setIsStarting(false);
    }
  };

  const benchmarkById = new Map(benchmarks.map(benchmark => [benchmark.id, benchmark]));
  const runIsActive = hasRunningBenchmarkRun(runs);
  const selectedRunIsActive = activeRun?.status === 'running';

  return (
    <div className="space-y-6">
      <section className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display font-black text-2xl text-black">Benchmarks</h2>
              <span className="text-[10px] font-black bg-[#38E05A] border-2 border-black px-2 py-0.5 rounded-md shadow-[1px_1px_0px_#000]">LIVE OLLAMA RUNS</span>
            </div>
            <p className="text-xs font-bold text-[#555] mt-1">Deterministic checks only. Each selected model runs every selected prompt independently.</p>
            {!isOllama && <p role="alert" className="text-xs font-black text-[#C0392B] mt-1">Switch to Ollama mode to run real benchmarks.</p>}
          </div>
          <button
            onClick={handleStart}
            disabled={!isOllama || isLoading || isStarting || runIsActive || !selectedModelIds.length || !selectedBenchmarkIds.length}
            className="px-5 py-3 bg-[#FFDE00] border-2 border-black rounded-xl text-xs font-black text-black shadow-[3px_3px_0px_#000] neo-btn flex items-center gap-2 disabled:opacity-50"
          >
            {runIsActive || isStarting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {runIsActive ? (selectedRunIsActive ? 'Benchmark running…' : 'Another benchmark running…') : isStarting ? 'Starting…' : 'Start benchmark'}
          </button>
        </div>
      </section>

      {error && (
        <div role="alert" className="p-4 bg-[#FF4F84]/20 border-2 border-black rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {runIsActive && !selectedRunIsActive && (
        <div role="status" className="p-3 bg-[#FFE277] border-2 border-black rounded-xl text-xs font-bold flex flex-wrap items-center justify-between gap-2">
          <span>A saved benchmark run is still in progress.</span>
          <button onClick={() => setActiveRun(runs.find(run => run.status === 'running') || null)} className="underline font-black">View running run</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000]">
          <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
            <h3 className="font-display font-black text-base">Models</h3>
            <span className="text-[10px] font-mono font-bold text-[#666]">{selectedModelIds.length} selected</span>
          </div>
          <div className="space-y-2 pt-3">
            {!models.length && <p className="text-xs font-bold text-[#666]">No Ollama models discovered. Refresh models from the app header.</p>}
            {models.map(model => (
              <label key={model.id} className="flex items-center gap-3 p-3 bg-[#FAFAF8] border-2 border-black rounded-xl cursor-pointer">
                <input type="checkbox" checked={selectedModelIds.includes(model.id)} onChange={() => toggleModel(model.id)} className="w-4 h-4 accent-black" />
                <span className="min-w-0">
                  <span className="block text-xs font-black truncate">{model.id}</span>
                  <span className="block text-[10px] font-bold text-[#666]">{model.parameterCount} · {model.defaultQuantization}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000]">
          <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
            <h3 className="font-display font-black text-base">Deterministic test cases</h3>
            <span className="text-[10px] font-mono font-bold text-[#666]">{selectedBenchmarkIds.length}/{benchmarks.length}</span>
          </div>
          <div className="max-h-72 overflow-y-auto space-y-2 pt-3">
            {benchmarks.map(benchmark => (
              <label key={benchmark.id} className="flex items-start gap-3 p-3 bg-[#FAFAF8] border-2 border-black rounded-xl cursor-pointer">
                <input type="checkbox" checked={selectedBenchmarkIds.includes(benchmark.id)} onChange={() => toggleBenchmark(benchmark.id)} className="w-4 h-4 mt-0.5 accent-black shrink-0" />
                <span className="min-w-0">
                  <span className="block text-xs font-black">{benchmark.name} <span className="font-mono text-[10px] text-[#666]">{benchmark.category}</span></span>
                  <span className="block text-[10px] font-bold text-[#555] mt-1">{benchmark.criteria}</span>
                  <span className="block text-[10px] font-mono text-[#666] mt-1">Scoring: {benchmark.scoringMethod}</span>
                </span>
              </label>
            ))}
            {!isLoading && !benchmarks.length && <p className="text-xs font-bold text-[#666]">No benchmark definitions are available.</p>}
          </div>
        </section>
      </div>

      {activeRun && (
        <section className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-black text-base">Run {activeRun.runId.slice(0, 8)}</h3>
              <p className="text-[11px] font-bold text-[#555]">{new Date(activeRun.createdAt).toLocaleString()} · {activeRun.status}</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-black">
              Saved runs
              <select value={activeRun.runId} onChange={event => setActiveRun(runs.find(run => run.runId === event.target.value) || null)} className="max-w-56 px-2 py-1 bg-white border-2 border-black rounded-lg text-xs">
                {runs.map(run => <option key={run.runId} value={run.runId}>{new Date(run.createdAt).toLocaleString()} · {run.status}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-[11px] font-mono font-bold mb-1">
              <span>{activeRun.progress.completed}/{activeRun.progress.total} model/test runs</span>
              <span>{selectedRunIsActive ? `${activeRun.progress.currentModelId || 'Preparing'} · ${activeRun.progress.currentBenchmarkId || ''}` : activeRun.status}</span>
            </div>
            <div className="h-3 bg-[#EAEAE5] border-2 border-black rounded-full overflow-hidden">
              <div className="h-full bg-[#38E05A] transition-[width]" style={{ width: `${activeRun.progress.total ? activeRun.progress.completed / activeRun.progress.total * 100 : 0}%` }} />
            </div>
          </div>
          {activeRun.error && <p className="mt-3 text-xs font-bold text-[#C0392B]">{activeRun.error}</p>}

          {!!activeRun.results.length && (
            <div className="mt-4 overflow-x-auto border-2 border-black rounded-xl">
              <table className="w-full min-w-[1100px] text-left text-[11px]">
                <thead className="bg-[#FFE277] border-b-2 border-black">
                  <tr>{['Benchmark', 'Category', 'Model', 'Run', 'Evaluation', 'Input', 'Output', 'Wall ms', 'Ollama ms', 'Generation ms', 'tok/s'].map(label => <th key={label} className="p-2 font-black whitespace-nowrap">{label}</th>)}</tr>
                </thead>
                <tbody>
                  {activeRun.results.map(result => {
                    const benchmark = benchmarkById.get(result.benchmarkId);
                    return (
                      <tr key={result.resultId} className="border-b border-black/10 align-top">
                        <td className="p-2 font-bold">{benchmark?.name || result.benchmarkId}</td>
                        <td className="p-2">{result.category}</td>
                        <td className="p-2 font-mono">{result.modelId}</td>
                        <td className="p-2">{result.status}</td>
                        <td className="p-2 font-black">{formatEvaluation(result)}</td>
                        <td className="p-2">{formatMetric(result.inputTokens)}</td>
                        <td className="p-2">{formatMetric(result.outputTokens)}</td>
                        <td className="p-2">{formatMetric(result.wallClockLatencyMs)}</td>
                        <td className="p-2">{formatMetric(result.ollamaTotalMs)}</td>
                        <td className="p-2">{formatMetric(result.generationMs)}</td>
                        <td className="p-2">{formatMetric(result.tokPerSec)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeRun.results.length > 0 && <p className="mt-3 text-[10px] font-bold text-[#555]">Scores use only the displayed deterministic check. They are not a subjective model-quality rating.</p>}
          {activeRun.results.some(result => result.error) && (
            <div className="mt-3 space-y-1">
              {activeRun.results.filter(result => result.error).map(result => <p key={result.resultId} className="text-[10px] font-bold text-[#C0392B]">{result.modelId} · {result.benchmarkId}: {result.error}</p>)}
            </div>
          )}
        </section>
      )}

      {!isLoading && !activeRun && (
        <div className="bg-white border-2 border-black rounded-2xl p-8 shadow-[4px_4px_0px_#000] text-center">
          <p className="font-display font-black text-base">No benchmark runs yet</p>
          <p className="text-xs font-bold text-[#555] mt-1">Select at least one discovered model and test case, then start a run.</p>
        </div>
      )}
    </div>
  );
};
