import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Play, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { BenchmarkDefinition, BenchmarkRun, Experiment, ExperimentComparison, ModelInfo } from '../types';
import { apiService } from '../services/api';
import { configurationForRerun, formatRecordedMetric, initialExperimentModels, toggleSelectedId } from '../services/experimentForm';

interface ExperimentsProps {
  experiments: Experiment[];
  onExperimentsChanged: () => Promise<void>;
  availableModels: ModelInfo[];
  isOllama: boolean;
}

const defaults = { temperature: 0, topP: 0.9, maxTokens: 128, timeoutSeconds: 180 };

export const Experiments: React.FC<ExperimentsProps> = ({ experiments, onExperimentsChanged, availableModels, isOllama }) => {
  const [benchmarks, setBenchmarks] = useState<BenchmarkDefinition[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [modelIds, setModelIds] = useState<string[]>([]);
  const [benchmarkIds, setBenchmarkIds] = useState<string[]>([]);
  const [settings, setSettings] = useState(defaults);
  const [selectedId, setSelectedId] = useState('');
  const [compareIds, setCompareIds] = useState<[string, string]>(['', '']);
  const [comparison, setComparison] = useState<ExperimentComparison | null>(null);
  const [activeRun, setActiveRun] = useState<BenchmarkRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const modelDefaultsApplied = useRef(false);

  useEffect(() => {
    let active = true;
    apiService.getBenchmarkDefinitions().then(defs => {
      if (!active) return;
      setBenchmarks(defs);
      setBenchmarkIds(defs.map(item => item.id));
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load test cases.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!modelDefaultsApplied.current && availableModels.length) {
      setModelIds(initialExperimentModels(availableModels.map(item => item.id)));
      modelDefaultsApplied.current = true;
    }
  }, [availableModels]);

  const selected = experiments.find(item => item.id === selectedId) || null;
  const unavailableModelIds = modelIds.filter(id => !availableModels.some(model => model.id === id));

  const loadConfiguration = (experiment: Experiment) => {
    const configuration = configurationForRerun(experiment);
    modelDefaultsApplied.current = true;
    setSelectedId(experiment.id);
    setName(configuration.name);
    setDescription(configuration.description);
    setModelIds(configuration.modelIds);
    setBenchmarkIds(configuration.benchmarkIds);
    setSettings(configuration.settings);
    setComparison(null);
  };

  const runExperiment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isOllama || busy || !name.trim() || !modelIds.length || !benchmarkIds.length) return;
    setBusy(true); setError(''); setComparison(null); setActiveRun(null);
    try {
      const runRequest = { modelIds, benchmarkIds, settings };
      let run = await apiService.startBenchmarkRun(runRequest);
      setActiveRun(run);
      while (run.status === 'running') {
        await new Promise(resolve => setTimeout(resolve, 700));
        run = await apiService.getBenchmarkRun(run.runId);
        setActiveRun(run);
      }
      if (run.status !== 'completed') throw new Error(`Benchmark run ended with status "${run.status}". Only completed runs can be saved as experiments.`);
      const saved = await apiService.saveExperiment({ name: name.trim(), description: description.trim(), runId: run.runId });
      setSelectedId(saved.id);
      await onExperimentsChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not run or save the experiment.');
    } finally { setBusy(false); }
  };

  const compare = async () => {
    if (!compareIds[0] || !compareIds[1] || compareIds[0] === compareIds[1]) return;
    setError(''); setComparison(null);
    try { setComparison(await apiService.compareExperiments(compareIds)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not compare experiments.'); }
  };

  const removeExperiment = async (id: string) => {
    try {
      await apiService.deleteExperiment(id);
      if (selectedId === id) setSelectedId('');
      setComparison(null);
      await onExperimentsChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete experiment.'); }
  };

  const toggle = (items: string[], id: string, setItems: (value: string[]) => void) => setItems(toggleSelectedId(items, id));

  return <div className="space-y-6">
    <section className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display font-black text-2xl">Experiments</h2>
          <p className="text-xs font-bold text-[#555] mt-1">Saved benchmark configurations and the actual results attached to each run.</p></div>
        <span className="text-[10px] font-black bg-[#FFDE00] border border-black px-2 py-1 rounded">{experiments.length} SAVED</span>
      </div>
    </section>

    {error && <div role="alert" className="p-3 bg-[#FF4F84]/20 border-2 border-black rounded-xl text-xs font-bold flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
    {!isOllama && <p role="alert" className="text-xs font-black text-red-700">Switch to Ollama mode to run and save real experiments.</p>}

    <form onSubmit={runExperiment} className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000] space-y-4">
      <div><h3 className="font-display font-black text-lg">Run configuration</h3>
        <p className="text-[11px] font-bold text-[#555]">A rerun creates a separate run and experiment record. Model responses can vary between runs.</p></div>
      <div className="grid md:grid-cols-2 gap-3">
        <label className="text-xs font-black">Experiment name<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full p-2 border-2 border-black rounded-lg font-medium" /></label>
        <label className="text-xs font-black">Description<textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 w-full p-2 border-2 border-black rounded-lg font-medium" rows={2} /></label>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <fieldset className="space-y-2"><legend className="font-black text-xs mb-2">Discovered Ollama models</legend>
          {!availableModels.length && <p className="text-xs text-[#666]">No models discovered. Refresh models from the app header.</p>}
          {unavailableModelIds.map(id => <label key={id} className="flex gap-2 text-xs p-2 bg-[#FFE8E8] border border-black rounded-lg"><input type="checkbox" checked onChange={() => toggle(modelIds, id, setModelIds)} /><span className="font-mono">{id} (not discovered)</span></label>)}
          {availableModels.map(model => <label key={model.id} className="flex gap-2 text-xs p-2 bg-[#FAFAF8] border border-black rounded-lg"><input type="checkbox" checked={modelIds.includes(model.id)} onChange={() => toggle(modelIds, model.id, setModelIds)} /><span className="font-mono">{model.id}</span></label>)}
        </fieldset>
        <fieldset className="space-y-2"><legend className="font-black text-xs mb-2">Benchmark test cases ({benchmarkIds.length} selected)</legend>
          <div className="max-h-56 overflow-y-auto space-y-1">{benchmarks.map(item => <label key={item.id} className="flex gap-2 text-xs p-2 bg-[#FAFAF8] border border-black rounded-lg"><input type="checkbox" checked={benchmarkIds.includes(item.id)} onChange={() => toggle(benchmarkIds, item.id, setBenchmarkIds)} /><span><strong>{item.name}</strong> <span className="text-[#666]">{item.category} · {item.id}</span></span></label>)}</div>
        </fieldset>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([['temperature', 0, 2, 0.1], ['topP', 0.01, 1, 0.01], ['maxTokens', 1, 8192, 1], ['timeoutSeconds', 1, 600, 1]] as const).map(([key, min, max, step]) => <label key={key} className="text-[11px] font-black">{key}<input type="number" min={min} max={max} step={step} value={settings[key]} onChange={e => setSettings(current => ({ ...current, [key]: Number(e.target.value) }))} className="mt-1 w-full p-2 border-2 border-black rounded-lg" /></label>)}
      </div>
      {unavailableModelIds.length > 0 && <p role="alert" className="text-xs font-bold text-red-700">These saved models are not currently discovered: {unavailableModelIds.join(', ')}. Refresh models or remove them from this configuration.</p>}
      <button disabled={!isOllama || loading || busy || !modelIds.length || unavailableModelIds.length > 0 || !benchmarkIds.length} className="px-4 py-2 bg-[#FFDE00] border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] disabled:opacity-50 flex items-center gap-2">{busy ? <><RefreshCw className="w-4 h-4 animate-spin" />Running benchmark…</> : <><Play className="w-4 h-4" />Run and save experiment</>}</button>
      {activeRun && <p className="text-xs font-bold">Run {activeRun.runId} · {activeRun.status} · {activeRun.progress.completed}/{activeRun.progress.total} cases</p>}
    </form>

    <section className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000]">
      <h3 className="font-display font-black text-lg mb-3">Saved history</h3>
      {loading ? <p className="text-xs font-bold">Loading experiments…</p> : !experiments.length ? <p className="text-xs font-bold text-[#666]">No saved experiments yet.</p> : <div className="space-y-2">
        {experiments.map(experiment => <div key={experiment.id} className="p-3 border-2 border-black rounded-xl bg-[#FAFAF8] flex flex-wrap items-start justify-between gap-3">
          <button onClick={() => setSelectedId(experiment.id)} className="text-left min-w-0"><strong className="block text-sm">{experiment.name}</strong><span className="block text-[11px] text-[#555]">{new Date(experiment.createdAt).toLocaleString()} · {experiment.runStatus || 'unknown'} · Run {experiment.runId}</span><span className="block text-[10px] font-mono mt-1">Models: {experiment.modelIds.join(', ')} · Cases: {experiment.benchmarkIds.length}</span></button>
          <div className="flex gap-2"><button onClick={() => loadConfiguration(experiment)} className="px-2 py-1 border-2 border-black rounded-lg text-[10px] font-black flex gap-1 items-center"><RotateCcw className="w-3 h-3" />Load config</button><button onClick={() => void removeExperiment(experiment.id)} aria-label={`Delete ${experiment.name}`} className="p-1"><Trash2 className="w-4 h-4" /></button></div>
        </div>)}
      </div>}
      {selected && <div className="mt-4 p-3 bg-white border-2 border-black rounded-xl text-xs space-y-1"><strong>{selected.name}</strong><p>{selected.description || 'No description.'}</p><p>Model IDs: {selected.modelIds.join(', ')}</p><p>Test-case IDs: {selected.benchmarkIds.join(', ')}</p><p>Settings: temperature {selected.settings.temperature}, top-p {selected.settings.topP}, max tokens {selected.settings.maxTokens}, timeout {selected.settings.timeoutSeconds}s</p><p>Run ID: <span className="font-mono">{selected.runId}</span></p><p>Run status: {selected.runStatus || 'unknown'}</p></div>}
    </section>

    {experiments.length >= 2 && <section className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000] space-y-3">
      <h3 className="font-display font-black text-lg">Compare saved experiments</h3>
      <div className="grid md:grid-cols-2 gap-3">{([0, 1] as const).map(index => <select key={index} aria-label={`Experiment ${index + 1}`} value={compareIds[index]} onChange={e => setCompareIds(current => index === 0 ? [e.target.value, current[1]] : [current[0], e.target.value])} className="p-2 border-2 border-black rounded-lg text-xs"><option value="">Select experiment {index + 1}</option>{experiments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>)}</div>
      <button onClick={() => void compare()} disabled={!compareIds[0] || !compareIds[1] || compareIds[0] === compareIds[1]} className="px-4 py-2 bg-[#FFDE00] border-2 border-black rounded-xl text-xs font-black disabled:opacity-50">Compare recorded results</button>
      {comparison && <>
        <p className={`p-3 border-2 border-black rounded-xl text-xs font-black ${comparison.configurations.comparable ? 'bg-[#D6FFD9]' : 'bg-[#FFE277]'}`}>{comparison.configurations.comparable ? 'Same benchmark cases and evaluation settings.' : `Not a fair head-to-head: benchmark sets ${comparison.configurations.sameBenchmarks ? 'match' : 'differ'}; settings ${comparison.configurations.sameSettings ? 'match' : 'differ'}.`}</p>
        <div className="grid md:grid-cols-2 gap-3">{comparison.results.map(result => <div key={result.experimentId} className="border-2 border-black rounded-xl p-3"><strong className="text-xs">{experiments.find(item => item.id === result.experimentId)?.name} · {result.status}</strong>{result.models.map(model => <div key={model.modelId} className="mt-2 p-2 bg-[#FAFAF8] rounded-lg text-[11px]"><strong className="font-mono">{model.modelId}</strong><p>Pass rate: {formatRecordedMetric(model.passRate === null ? null : Number((model.passRate * 100).toFixed(1)), '%')} ({model.evaluatedCases} evaluated)</p><p>Failed inferences: {model.failedInferences} · Unavailable evaluations: {model.unavailableEvaluations}</p><p>Median wall latency: {formatRecordedMetric(model.medianWallLatencyMs, ' ms')}</p></div>)}</div>)}</div>
      </>}
    </section>}
    <p className="text-[10px] font-bold text-[#555]">Benchmark checks are narrow deterministic evaluations of nondeterministic model responses. Repeating an experiment does not guarantee identical outputs.</p>
  </div>;
};
