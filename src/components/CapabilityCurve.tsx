import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { BenchmarkCategory, BenchmarkRun } from '../types';
import { apiService } from '../services/api';
import { aggregateCapabilityRun, selectCapabilityRun, selectCompletedBenchmarkRuns, summarizeCapabilityModel, validateCapabilityModelComparison } from '../services/capabilityMetrics';

type ChartView = 'pass-rate' | 'latency';

const modelColors = ['#FF4F84', '#38E05A', '#7C69EF', '#FFA25B'];

function formatMetric(value: number | null, unit = ''): string {
  return value === null ? 'N/A' : `${value}${unit}`;
}

function formatCategory(category: BenchmarkCategory): string {
  return category.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

interface CapabilityCurveProps {
  onOpenRun: (runId: string) => void;
}

export const CapabilityCurve: React.FC<CapabilityCurveProps> = ({ onOpenRun }) => {
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [comparisonModelIds, setComparisonModelIds] = useState<string[]>([]);
  const [inspectedPoint, setInspectedPoint] = useState<{ modelId: string; category: BenchmarkCategory } | null>(null);
  const [chartView, setChartView] = useState<ChartView>('pass-rate');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = async () => {
    setIsLoading(true);
    try {
      const savedRuns = await apiService.getBenchmarkRuns();
      setRuns(selectCompletedBenchmarkRuns(savedRuns));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load saved benchmark runs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadRuns(); }, []);

  const completedRuns = selectCompletedBenchmarkRuns(runs);
  const selectedRun = selectCapabilityRun(completedRuns, selectedRunId);
  const runModelIds = selectedRun?.modelIds || [];
  const activeModelId = runModelIds.includes(selectedModelId) ? selectedModelId : runModelIds[0] || '';
  const categoryMetrics = aggregateCapabilityRun(selectedRun);
  const visibleModelIds = comparisonModelIds.filter(id => runModelIds.includes(id));
  const visibleMetrics = categoryMetrics.filter(metric => visibleModelIds.includes(metric.modelId));
  const comparison = selectedRun ? validateCapabilityModelComparison(selectedRun, visibleModelIds) : null;
  const categories = [...new Set(visibleMetrics.map(metric => metric.category))];
  const chartRows = categories.map(category => {
    const row: Record<string, string | number | null> = { category: formatCategory(category) };
    visibleModelIds.forEach((modelId, index) => {
      const metric = visibleMetrics.find(item => item.modelId === modelId && item.category === category);
      row[`passRate_${index}`] = metric?.passRatePercent ?? null;
      row[`passSample_${index}`] = metric?.evaluatedCount ? `${metric.passedCount}/${metric.evaluatedCount}` : 'N/A';
      row[`latency_${index}`] = metric?.medianWallLatencyMs ?? null;
      row[`latencySample_${index}`] = metric?.latencySampleCount ? `n=${metric.latencySampleCount}` : 'N/A';
    });
    return row;
  });
  const modelSummary = selectedRun && activeModelId
    ? summarizeCapabilityModel(selectedRun, activeModelId)
    : null;
  const chartHasData = chartRows.some(row => visibleModelIds.some((_modelId, index) => row[chartView === 'pass-rate' ? `passRate_${index}` : `latency_${index}`] !== null));

  useEffect(() => {
    if (!selectedRun) return;
    setSelectedModelId(selectedRun.modelIds[0] || '');
    setComparisonModelIds(selectedRun.modelIds.slice(0, 2));
    setInspectedPoint(null);
  }, [selectedRun?.runId]);

  const toggleComparisonModel = (modelId: string) => {
    setComparisonModelIds(current => current.includes(modelId)
      ? current.filter(id => id !== modelId)
      : [...current, modelId]);
  };

  const inspectedResults = selectedRun && inspectedPoint
    ? selectedRun.results.filter(result => result.modelId === inspectedPoint.modelId && result.category === inspectedPoint.category)
    : [];

  return (
    <div className="space-y-6">
      <section className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-black text-2xl text-black">Capability Curve</h2>
              <span className="text-[10px] font-black bg-[#38E05A] border-2 border-black px-2 py-0.5 rounded-md shadow-[1px_1px_0px_#000]">BENCHMARK EVIDENCE</span>
            </div>
            <p className="text-xs font-bold text-[#555] mt-1">Deterministic benchmark checks measure only their stated criteria, not overall intelligence. No weight blending is performed.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-black" htmlFor="capability-run">Completed run</label>
            <select
              id="capability-run"
              value={selectedRun?.runId || ''}
              onChange={event => setSelectedRunId(event.target.value)}
              disabled={!completedRuns.length}
              className="max-w-64 px-2 py-1 bg-white border-2 border-black rounded-lg text-xs font-bold disabled:opacity-50"
            >
              {completedRuns.map(run => <option key={run.runId} value={run.runId}>{new Date(run.createdAt).toLocaleString()} · {run.runId.slice(0, 8)}</option>)}
            </select>
            <button onClick={() => void loadRuns()} disabled={isLoading} title="Refresh saved benchmark runs" className="w-9 h-9 bg-[#FFDE00] border-2 border-black rounded-lg flex items-center justify-center neo-btn disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </section>

      {error && <div role="alert" className="p-4 bg-[#FF4F84]/20 border-2 border-black rounded-xl text-xs font-bold text-[#C0392B]">{error}</div>}

      {!isLoading && !error && !completedRuns.length && (
        <div className="bg-white border-2 border-black rounded-2xl p-8 shadow-[4px_4px_0px_#000] text-center">
          <p className="font-display font-black text-base">No completed benchmark runs</p>
          <p className="text-xs font-bold text-[#555] mt-1">Run benchmarks from the Benchmarks page. Only saved completed runs appear here.</p>
        </div>
      )}

      {selectedRun && (
        <>
          <section className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  <h3 className="font-display font-black text-base">{chartView === 'pass-rate' ? 'Pass rate by benchmark category' : 'Median measured wall latency by category'}</h3>
                </div>
                <p className="text-[11px] font-bold text-[#555] mt-1">Run ID: <span className="font-mono">{selectedRun.runId}</span> · {selectedRun.benchmarkIds.length} test cases · temperature {selectedRun.settings.temperature}, top-p {selectedRun.settings.topP}, max tokens {selectedRun.settings.maxTokens}, timeout {selectedRun.settings.timeoutSeconds}s.</p>
              </div>
              <div className="flex items-center gap-1.5 bg-[#FAFAF8] p-1.5 border-2 border-black rounded-xl">
                <button onClick={() => setChartView('pass-rate')} className={`px-3 py-1 text-xs font-black rounded-lg border border-black neo-btn ${chartView === 'pass-rate' ? 'bg-black text-white' : 'bg-white text-black'}`}>Pass rate</button>
                <button onClick={() => setChartView('latency')} className={`px-3 py-1 text-xs font-black rounded-lg border border-black neo-btn ${chartView === 'latency' ? 'bg-black text-white' : 'bg-white text-black'}`}>Wall latency</button>
              </div>
            </div>

            <fieldset className="mt-4 p-3 border-2 border-black rounded-xl bg-[#FAFAF8]">
              <legend className="px-1 text-xs font-black">Models to compare in this run</legend>
              <div className="flex flex-wrap gap-2">
                {runModelIds.map(modelId => (
                  <label key={modelId} className="flex items-center gap-2 px-2 py-1 border border-black rounded-lg bg-white text-[11px] font-mono font-bold">
                    <input type="checkbox" checked={comparisonModelIds.includes(modelId)} onChange={() => toggleComparisonModel(modelId)} />{modelId}
                  </label>
                ))}
              </div>
              <p className={`mt-2 text-[11px] font-bold ${comparison?.comparable ? 'text-[#176B2C]' : 'text-[#A33]'}`}>
                {visibleModelIds.length < 2
                  ? 'Select at least two models to compare.'
                  : comparison?.comparable
                    ? 'Directly comparable: selected models have recorded results for the same cases and share this run’s evaluation settings.'
                    : 'Not directly comparable: recorded case coverage differs from the selected run’s benchmark set. Missing cases are not plotted as scores.'}
              </p>
              {comparison && !comparison.comparable && comparison.reason === 'case-coverage-differs' && (
                <p className="mt-1 text-[10px] font-mono text-[#555]">{comparison.casesByModel.map(item => `${item.modelId}: missing [${item.missingCaseIds.join(', ') || 'none'}], extra [${item.extraCaseIds.join(', ') || 'none'}]`).join(' · ')}</p>
              )}
            </fieldset>

            <div className="h-80 w-full mt-4">
              {chartHasData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartRows} margin={{ top: 24, right: 20, left: 4, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DDD" vertical={false} />
                    <XAxis dataKey="category" stroke="#000" tick={{ fill: '#000', fontSize: 11, fontWeight: 700 }} />
                    <YAxis
                      stroke="#000"
                      domain={chartView === 'pass-rate' ? [0, 100] : [0, 'auto']}
                      label={{ value: chartView === 'pass-rate' ? 'Pass rate %' : 'Wall latency ms', angle: -90, position: 'insideLeft', fill: '#000', fontSize: 11, fontWeight: 800 }}
                    />
                    <Tooltip />
                    <Legend />
                    {visibleModelIds.map((modelId, index) => (
                      <Bar
                        key={modelId}
                        dataKey={chartView === 'pass-rate' ? `passRate_${index}` : `latency_${index}`}
                        name={modelId}
                        fill={modelColors[index % modelColors.length]}
                        stroke="#000"
                        strokeWidth={1}
                      >
                        <LabelList dataKey={chartView === 'pass-rate' ? `passSample_${index}` : `latencySample_${index}`} position="top" fontSize={10} />
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-center text-xs font-bold text-[#666]">
                  {chartView === 'pass-rate' ? 'No valid completed evaluations in this run.' : 'No valid wall-clock latency measurements in this run.'}
                </div>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-8 bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000]">
              <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                <h3 className="font-display font-black text-base">Model/category evidence</h3>
                <span className="text-[10px] font-mono font-bold text-[#666]">Run {selectedRun.runId.slice(0, 8)}</span>
              </div>
              <div className="mt-3 overflow-x-auto border-2 border-black rounded-xl">
                <table className="w-full min-w-[800px] text-left text-[11px]">
                  <thead className="bg-[#FFE277] border-b-2 border-black">
                    <tr>{['Category', 'Model', 'Pass rate (passed/evaluated)', 'Evaluated', 'Inference failed', 'Evaluation N/A', 'Median wall latency (n)', 'Cases'].map(label => <th key={label} className="p-2 font-black whitespace-nowrap">{label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {visibleMetrics.map(metric => {
                      const isInspected = inspectedPoint?.modelId === metric.modelId && inspectedPoint.category === metric.category;
                      return <React.Fragment key={`${metric.modelId}-${metric.category}`}>
                        <tr className="border-b border-black/10">
                          <td className="p-2 font-bold">{formatCategory(metric.category)}</td>
                          <td className="p-2 font-mono">{metric.modelId}</td>
                          <td className="p-2">{formatMetric(metric.passRatePercent, '%')} ({metric.passedCount}/{metric.evaluatedCount})</td>
                          <td className="p-2">{metric.evaluatedCount}</td>
                          <td className="p-2">{metric.inferenceFailedCount}</td>
                          <td className="p-2">{metric.evaluationUnavailableCount}</td>
                          <td className="p-2">{formatMetric(metric.medianWallLatencyMs, ' ms')} (n={metric.latencySampleCount})</td>
                          <td className="p-2"><button className="underline font-black" onClick={() => setInspectedPoint(isInspected ? null : { modelId: metric.modelId, category: metric.category })}>{isInspected ? 'Hide cases' : 'Inspect cases'}</button></td>
                        </tr>
                        {isInspected && <tr className="border-b-2 border-black bg-[#FAFAF8]"><td colSpan={8} className="p-3"><div className="space-y-2">{inspectedResults.map(result => {
                          const outcome = result.status === 'failed' ? 'Inference failed' : result.status === 'timeout' ? 'Inference timed out' : result.evaluationStatus !== 'evaluated' || result.passed === null ? 'Evaluation unavailable' : result.passed ? 'Passed' : 'Valid evaluation failed';
                          return <div key={result.resultId} className="p-2 bg-white border border-black rounded-lg text-[10px]"><div className="flex flex-wrap justify-between gap-2"><strong className="font-mono">{result.benchmarkId}</strong><span className="font-black">{outcome}</span><span>{formatMetric(result.wallClockLatencyMs, ' ms')} wall latency</span><span>{new Date(result.completedAt).toLocaleString()}</span></div><pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[#555]">{result.output || result.error || 'No output recorded.'}</pre></div>;
                        })}</div></td></tr>}
                      </React.Fragment>;
                    })}
                    {!visibleMetrics.length && <tr><td colSpan={8} className="p-4 text-center font-bold text-[#666]">No results for the selected models in this completed run.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] font-bold text-[#555] mt-3">Failed inference and unavailable evaluation cases are excluded from the pass-rate denominator and shown separately. Latency is the median recorded wall-clock duration per category, including failed attempts when a duration was recorded; n is the number of measurements.</p>
              <button onClick={() => onOpenRun(selectedRun.runId)} className="mt-3 px-3 py-2 bg-[#FFDE00] border-2 border-black rounded-lg text-[11px] font-black shadow-[2px_2px_0px_#000]">Open run in Benchmarks</button>
            </section>

            <aside className="lg:col-span-4">
              <div className="w-24 h-3.5 bg-[#FF4F84] border-t-2 border-x-2 border-black rounded-t-lg ml-3" />
              <div className="bg-white border-2 border-black rounded-2xl rounded-tl-none p-5 shadow-[4px_4px_0px_#000] min-h-[320px]">
                <div className="pb-3 border-b-2 border-black/10">
                  <span className="text-[10px] font-black uppercase text-[#666]">Measured model</span>
                  <select value={activeModelId} onChange={event => setSelectedModelId(event.target.value)} className="block w-full mt-1 px-2 py-1 bg-white border-2 border-black rounded-lg text-xs font-mono font-bold">
                    {runModelIds.map(modelId => <option key={modelId} value={modelId}>{modelId}</option>)}
                  </select>
                </div>
                {modelSummary && (
                  <div className="grid grid-cols-2 gap-3 my-4">
                    <div className="bg-[#FAFAF8] border-2 border-black rounded-xl p-3">
                      <span className="text-[10px] font-black uppercase text-[#666]">Run ID</span>
                      <span className="block mt-1 font-mono text-[10px] break-all">{selectedRun.runId}</span>
                    </div>
                    <div className="bg-[#FAFAF8] border-2 border-black rounded-xl p-3">
                      <span className="text-[10px] font-black uppercase text-[#666]">Evaluated cases</span>
                      <span className="block mt-1 font-display font-black text-xl">{modelSummary.evaluatedCount}</span>
                    </div>
                    <div className="bg-[#FAFAF8] border-2 border-black rounded-xl p-3">
                      <span className="text-[10px] font-black uppercase text-[#666]">Pass rate (n)</span>
                      <span className="block mt-1 font-display font-black text-xl">{formatMetric(modelSummary.passRatePercent, '%')}</span>
                      <span className="text-[10px] font-bold">{modelSummary.passedCount}/{modelSummary.evaluatedCount} evaluated</span>
                    </div>
                    <div className="bg-[#FAFAF8] border-2 border-black rounded-xl p-3">
                      <span className="text-[10px] font-black uppercase text-[#666]">Median wall latency</span>
                      <span className="block mt-1 font-display font-black text-xl">{formatMetric(modelSummary.medianWallLatencyMs, ' ms')}</span>
                      <span className="text-[10px] font-bold">n={modelSummary.latencySampleCount}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs font-bold text-[#555]">Inference failures: {modelSummary?.inferenceFailedCount ?? 0} · Evaluation unavailable: {modelSummary?.evaluationUnavailableCount ?? 0}</p>
                <p className="text-[10px] font-bold text-[#666] mt-3">Style scores are not measured here. The checks shown are narrow criteria-based evaluations, not an overall capability score.</p>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
};
