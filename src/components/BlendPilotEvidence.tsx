import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Compass, RefreshCw } from 'lucide-react';
import { BenchmarkCategory, BenchmarkRun, BlendPilotPreference, BlendPilotRecommendationResult } from '../types';
import { apiService } from '../services/api';
import { blendPilotRequestKey } from '../services/blendPilotRequest';

interface BlendPilotEvidenceProps {
  isOllama: boolean;
}

const displayCategory = (category: string) => category.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const displayValue = (value: number | null, unit = '') => value === null ? 'N/A' : `${value}${unit}`;

export const BlendPilotEvidence: React.FC<BlendPilotEvidenceProps> = ({ isOllama }) => {
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<BenchmarkCategory | ''>('');
  const [comparisonModelId, setComparisonModelId] = useState('');
  const [preference, setPreference] = useState<BlendPilotPreference>('correctness');
  const [minimumEvaluations, setMinimumEvaluations] = useState(2);
  const [result, setResult] = useState<BlendPilotRecommendationResult | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [isRecommending, setIsRecommending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recommendationRequestKey = useRef('');
  const requestVersion = useRef(0);

  const loadRuns = async () => {
    setIsLoadingRuns(true);
    try {
      const history = await apiService.getBenchmarkRuns();
      const completed = history.filter(run => run.status === 'completed');
      setRuns(completed);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load saved benchmark runs.');
    } finally {
      setIsLoadingRuns(false);
    }
  };

  useEffect(() => { void loadRuns(); }, []);

  const selectedRun = runs.find(run => run.runId === selectedRunId) || runs[0] || null;
  const categories = [...new Set(selectedRun?.results.map(item => item.category) || [])] as BenchmarkCategory[];
  const selectedCategoryModelIds = selectedRun
    ? [...new Set(selectedRun.results.filter(item => item.category === selectedCategory).map(item => item.modelId))]
    : [];
  const currentRequestKey = selectedRun && selectedCategory && comparisonModelId
    ? blendPilotRequestKey({ runId: selectedRun.runId, category: selectedCategory, comparisonModelId, preference, minimumEvaluations })
    : '';
  recommendationRequestKey.current = currentRequestKey;

  useEffect(() => {
    requestVersion.current += 1;
    setResult(null);
    setIsRecommending(false);
    setError(null);
  }, [currentRequestKey]);

  useEffect(() => {
    if (!selectedRun) {
      setSelectedRunId('');
      setSelectedCategory('');
      setComparisonModelId('');
      setResult(null);
      return;
    }
    setSelectedRunId(selectedRun.runId);
    const nextCategory = selectedCategory && categories.includes(selectedCategory) ? selectedCategory : categories[0] || '';
    setSelectedCategory(nextCategory);
    const modelIds = [...new Set(selectedRun.results.filter(item => item.category === nextCategory).map(item => item.modelId))];
    setComparisonModelId(current => modelIds.includes(current) ? current : modelIds[0] || '');
    setResult(null);
  }, [selectedRun?.runId]);

  useEffect(() => {
    if (selectedCategoryModelIds.length && !selectedCategoryModelIds.includes(comparisonModelId)) {
      setComparisonModelId(selectedCategoryModelIds[0]);
      setResult(null);
    }
  }, [selectedCategory, selectedRun?.runId]);

  const handleRecommend = async () => {
    if (!isOllama || !selectedRun || !selectedCategory || !comparisonModelId || isRecommending) return;
    const activeRequestVersion = ++requestVersion.current;
    const activeRequestKey = currentRequestKey;
    setIsRecommending(true);
    setError(null);
    try {
      const recommendation = await apiService.getBlendPilotRecommendation({
        runId: selectedRun.runId,
        category: selectedCategory,
        comparisonModelId,
        preference,
        minimumEvaluations,
      });
      if (requestVersion.current === activeRequestVersion && recommendationRequestKey.current === activeRequestKey) setResult(recommendation);
    } catch (reason) {
      if (requestVersion.current === activeRequestVersion && recommendationRequestKey.current === activeRequestKey) setError(reason instanceof Error ? reason.message : 'Could not calculate a recommendation.');
    } finally {
      if (requestVersion.current === activeRequestVersion) setIsRecommending(false);
    }
  };

  const currentRun = result ? runs.find(run => run.runId === result.runId) || selectedRun : selectedRun;

  return (
    <div className="space-y-6">
      <section className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display font-black text-2xl text-black">BlendPilot</h2>
              <span className="text-[10px] font-black bg-[#38E05A] border-2 border-black px-2 py-0.5 rounded-md shadow-[1px_1px_0px_#000]">BENCHMARK EVIDENCE</span>
            </div>
            <p className="text-xs font-bold text-[#555] mt-1">Recommendations use only measured deterministic checks in a saved completed run. This does not blend model weights.</p>
            {!isOllama && <p role="alert" className="text-xs font-black text-[#C0392B] mt-1">Switch to Ollama mode to use saved local benchmark evidence.</p>}
          </div>
          <button onClick={() => void loadRuns()} disabled={isLoadingRuns} title="Refresh saved runs" className="w-9 h-9 bg-[#FFDE00] border-2 border-black rounded-lg flex items-center justify-center neo-btn disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isLoadingRuns ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </section>

      {error && <div role="alert" className="p-4 bg-[#FF4F84]/20 border-2 border-black rounded-xl text-xs font-bold text-[#C0392B] flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

      {!isLoadingRuns && !error && !runs.length && (
        <div className="bg-white border-2 border-black rounded-2xl p-8 shadow-[4px_4px_0px_#000] text-center">
          <p className="font-display font-black text-base">No completed benchmark evidence</p>
          <p className="text-xs font-bold text-[#555] mt-1">Complete a benchmark run first. BlendPilot does not infer or estimate missing results.</p>
        </div>
      )}

      {!!runs.length && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-5">
            <div className="w-24 h-3.5 bg-[#FFE277] border-t-2 border-x-2 border-black rounded-t-lg ml-3" />
            <div className="bg-white border-2 border-black rounded-2xl rounded-tl-none p-5 shadow-[4px_4px_0px_#000]">
              <div className="pb-3 border-b-2 border-black/10">
                <h3 className="font-display font-black text-base">Evidence selection</h3>
                <p className="text-[11px] font-bold text-[#555]">Choose a completed run, benchmark category, and comparison model.</p>
              </div>
              <div className="space-y-4 mt-4">
                <label className="block text-xs font-black">Completed benchmark run
                  <select value={selectedRun?.runId || ''} onChange={event => { setSelectedRunId(event.target.value); setResult(null); }} className="block w-full mt-1 px-2 py-2 bg-white border-2 border-black rounded-lg text-xs font-mono">
                    {runs.map(run => <option key={run.runId} value={run.runId}>{new Date(run.createdAt).toLocaleString()} · {run.runId.slice(0, 8)}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-black">Benchmark category
                  <select value={selectedCategory} onChange={event => { setSelectedCategory(event.target.value as BenchmarkCategory); setResult(null); }} className="block w-full mt-1 px-2 py-2 bg-white border-2 border-black rounded-lg text-xs">
                    {categories.map(category => <option key={category} value={category}>{displayCategory(category)}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-black">Compare against
                  <select value={comparisonModelId} onChange={event => { setComparisonModelId(event.target.value); setResult(null); }} className="block w-full mt-1 px-2 py-2 bg-white border-2 border-black rounded-lg text-xs font-mono">
                    {selectedCategoryModelIds.map(modelId => <option key={modelId} value={modelId}>{modelId}</option>)}
                  </select>
                </label>
                <fieldset>
                  <legend className="text-xs font-black mb-1">Priority</legend>
                  <div className="flex gap-2">
                    {(['correctness', 'latency'] as const).map(value => (
                      <button key={value} onClick={() => { setPreference(value); setResult(null); }} className={`flex-1 py-2 text-xs font-black capitalize border-2 border-black rounded-lg neo-btn ${preference === value ? 'bg-black text-white' : 'bg-white text-black'}`}>{value}-first</button>
                    ))}
                  </div>
                </fieldset>
                <label className="block text-xs font-black">Minimum valid evaluations
                  <input type="number" min="1" max="100" value={minimumEvaluations} onChange={event => { setMinimumEvaluations(Number(event.target.value)); setResult(null); }} className="block w-full mt-1 px-2 py-2 bg-white border-2 border-black rounded-lg text-xs font-mono" />
                </label>
                <button onClick={() => void handleRecommend()} disabled={!isOllama || !selectedCategoryModelIds.length || !comparisonModelId || minimumEvaluations < 1 || minimumEvaluations > 100 || isRecommending} className="w-full py-3 bg-[#FFDE00] border-2 border-black rounded-xl text-xs font-black text-black shadow-[3px_3px_0px_#000] neo-btn flex items-center justify-center gap-2 disabled:opacity-50">
                  <Compass className={`w-4 h-4 ${isRecommending ? 'animate-spin' : ''}`} />
                  {isRecommending ? 'Comparing evidence…' : 'Calculate from saved evidence'}
                </button>
              </div>
            </div>
          </section>

          <section className="lg:col-span-7">
            <div className="w-28 h-3.5 bg-[#38E05A] border-t-2 border-x-2 border-black rounded-t-lg ml-3" />
            <div className="bg-white border-2 border-black rounded-2xl rounded-tl-none p-5 shadow-[6px_6px_0px_#000] min-h-[360px]">
              {!result ? (
                <div className="py-12 text-center text-xs font-bold text-[#666]">
                  <p>Select saved evidence and calculate a recommendation.</p>
                  <p className="mt-2">Minimum evaluations are required for both the comparison model and recommended alternative.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b-2 border-black/10">
                    <div>
                      <span className="text-[10px] font-black uppercase text-[#666]">{result.status === 'recommended' ? 'Recommended alternative' : 'Recommendation unavailable'}</span>
                      <h3 className="font-display font-black text-xl mt-1">{result.recommendedModelId || 'Insufficient evidence'}</h3>
                    </div>
                    <span className="text-[10px] font-mono font-black bg-[#FFE277] border-2 border-black px-2 py-1 rounded-md">{result.preference}-first</span>
                  </div>
                  <p className="my-4 p-3 bg-[#FAFAF8] border-2 border-black rounded-xl text-xs font-bold">{result.reason}</p>
                  <div className="text-xs font-mono font-bold space-y-1">
                    <p>Run: {currentRun?.runId || result.runId}</p>
                    <p>Category: {displayCategory(result.category)}</p>
                    <p>Compared against: {result.comparisonModelId}</p>
                    <p>Minimum valid evaluations: {result.minimumEvaluations}</p>
                  </div>
                  <div className="mt-4 overflow-x-auto border-2 border-black rounded-xl">
                    <table className="w-full min-w-[670px] text-left text-[10px]">
                      <thead className="bg-[#FFE277] border-b-2 border-black"><tr>{['Model', 'Evaluated', 'Passed', 'Pass rate', 'Failed inference', 'Evaluation N/A', 'Median wall ms (n)', 'Evidence cases'].map(label => <th key={label} className="p-2 font-black">{label}</th>)}</tr></thead>
                      <tbody>
                        {result.candidates.map(candidate => (
                          <tr key={candidate.modelId} className={`border-b border-black/10 ${candidate.modelId === result.recommendedModelId ? 'bg-[#38E05A]/15' : ''}`}>
                            <td className="p-2 font-mono font-bold">{candidate.modelId}{candidate.modelId === result.comparisonModelId ? ' · comparison' : candidate.modelId === result.recommendedModelId ? ' · recommended' : ''}</td>
                            <td className="p-2">{candidate.evaluatedCount}</td>
                            <td className="p-2">{candidate.passedCount}</td>
                            <td className="p-2">{displayValue(candidate.passRatePercent, '%')}</td>
                            <td className="p-2">{candidate.inferenceFailedCount}</td>
                            <td className="p-2">{candidate.unavailableEvaluationCount}</td>
                            <td className="p-2">{displayValue(candidate.medianWallLatencyMs)} (n={candidate.latencySampleCount})</td>
                            <td className="p-2 font-mono">{candidate.benchmarkIds.join(', ') || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
