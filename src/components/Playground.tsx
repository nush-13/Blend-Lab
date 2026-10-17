import React, { useEffect, useRef, useState } from 'react';
import { ModelInfo, MergeMethod, ModelResponse, BlendConfiguration, GraphifyContext } from '../types';
import { createFailedResponses, createIdleResponses, createPendingResponses } from '../services/playgroundState';
import { BlendSlider } from './BlendSlider';
import { 
  Plus, 
  Send, 
  Copy, 
  Check, 
  Sparkles, 
  AlertCircle, 
  Feather, 
  Terminal, 
  FileCode, 
  HelpCircle,
  Hash,
  Paperclip
} from 'lucide-react';

interface PlaygroundProps {
  isOllama: boolean;
  canGenerate: boolean;
  modelA: ModelInfo;
  modelB: ModelInfo;
  ratioB: number;
  onChangeRatioB: (ratio: number) => void;
  mergeMethod: MergeMethod;
  onChangeMethod: (method: MergeMethod) => void;
  onOpenModelSelectA: () => void;
  onOpenModelSelectB: () => void;
  onGenerateResponses: (prompt: string, config: BlendConfiguration) => Promise<{
    sourceA: ModelResponse;
    candidate: ModelResponse;
    sourceB: ModelResponse;
    graphifyContext?: GraphifyContext | null;
  }>;
}

export const Playground: React.FC<PlaygroundProps> = ({
  isOllama,
  canGenerate,
  modelA,
  modelB,
  ratioB,
  onChangeRatioB,
  mergeMethod,
  onChangeMethod,
  onOpenModelSelectA,
  onOpenModelSelectB,
  onGenerateResponses
}) => {
  const [prompt, setPrompt] = useState(
    'Soft rain on the harbour wall, the lamps are low, the boats are small. Write a poetic ballad with an embedded Python simulation class.'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'duo' | 'trio'>('duo');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [useGraphifyContext, setUseGraphifyContext] = useState(false);
  const [graphifyContext, setGraphifyContext] = useState<GraphifyContext | null>(null);

  const [responses, setResponses] = useState(() => createIdleResponses(modelA.id, modelB.id));
  const requestVersion = useRef(0);

  useEffect(() => {
    requestVersion.current += 1;
    setIsLoading(false);
    setError(null);
    setGraphifyContext(null);
    setResponses(createIdleResponses(modelA.id, modelB.id));
  }, [modelA.id, modelB.id, ratioB, useGraphifyContext]);

  const promptPresets = [
    {
      label: 'Harbor Ballad + Code',
      icon: Feather,
      color: '#FFE277',
      text: 'Soft rain on the harbour wall, the lamps are low, the boats are small. Write a poetic ballad with an embedded Python simulation class.'
    },
    {
      label: 'Rust Concurrency',
      icon: Terminal,
      color: '#38E05A',
      text: 'Write an idiomatic Rust threadpool worker with graceful shutdown channels and concise architectural docstrings.'
    },
    {
      label: 'JSON Schema Invariant',
      icon: FileCode,
      color: '#FF4F84',
      text: 'Generate a clean JSON config for an inference engine with keys: model_id, batch_size, precision, and timeout. Return pure JSON without markdown backticks.'
    },
    {
      label: 'Deductive Logic Puzzle',
      icon: HelpCircle,
      color: '#7C69EF',
      text: 'Three containers hold red, green, and mixed balls. All three labels are wrong. If you pick one ball from "Mixed", prove which label belongs where.'
    }
  ];

  const handleRunInference = async () => {
    if (!prompt.trim() || !canGenerate || isLoading) return;
    const activeRequestVersion = ++requestVersion.current;
    setIsLoading(true);
    setError(null);
    setGraphifyContext(null);
    setResponses(createPendingResponses(modelA.id, modelB.id));

    const config: BlendConfiguration = {
      useGraphifyContext: isOllama && useGraphifyContext,
      id: `blend-${Date.now()}`,
      modelA,
      modelB,
      ratioA: 100 - ratioB,
      ratioB,
      method: mergeMethod,
      candidateName: `BLEND-LAB-c${ratioB}-${mergeMethod}`,
      candidateTag: `sweep_${String(ratioB).padStart(3, '0')} · Q4_K_M · t=${ratioB}%`,
      quantization: 'Q4_K_M'
    };

    try {
      const res = await onGenerateResponses(prompt, config);
      if (requestVersion.current === activeRequestVersion) { setResponses(res); setGraphifyContext(res.graphifyContext ?? null); }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Inference evaluation failed.';
      if (requestVersion.current === activeRequestVersion) {
        setError(message);
        setResponses(createFailedResponses(modelA.id, modelB.id, message));
      }
    } finally {
      if (requestVersion.current === activeRequestVersion) setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatMetric = (value: number | null, unit = '') => value === null ? 'N/A' : `${value}${unit}`;
  const formatGeneration = (response: ModelResponse) => response.status === 'success' && response.generationMs === null
    ? 'N/A (eval_duration unavailable)'
    : formatMetric(response.generationMs, ' ms');
  const candidateOrigin = responses.candidate.provenance === 'routed'
    ? `Routed from ${responses.candidate.routedFrom === 'sourceB' ? 'B' : 'A'}${responses.candidate.measurementSource && responses.candidate.measurementSource !== responses.candidate.routedFrom ? ` · inference from ${responses.candidate.measurementSource === 'sourceA' ? 'A' : 'B'}` : ''}`
    : responses.candidate.provenance === 'demo' ? 'Simulated response' : 'Candidate';

  return (
    <div className="space-y-6">
      {/* Blend Slider Stage */}
      <BlendSlider
        isOllama={isOllama}
        modelA={modelA}
        modelB={modelB}
        ratioB={ratioB}
        onChangeRatioB={onChangeRatioB}
        mergeMethod={mergeMethod}
        onChangeMethod={onChangeMethod}
        candidateTag={isOllama ? 'Ollama model routing' : `Demo sweep ${ratioB}%`}
        contextUsed={responses.candidate.contextUsed}
        maxContext={modelA.contextWindow}
        onOpenModelSelectA={onOpenModelSelectA}
        onOpenModelSelectB={onOpenModelSelectB}
      />

      {/* Prompt Composer Bar (Styled like the exact search/input bar + yellow plus button from the screenshot!) */}
      <div>
        <label className="block font-black text-sm text-black uppercase tracking-wider mb-2">
          Prompt Composer & Evaluation Input
        </label>
        <div className="flex items-center gap-3">
          {/* Main Input Box */}
          <div className="flex-1 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] p-3 flex items-center gap-3">
            <span className="font-mono text-lg font-black text-black">#</span>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRunInference();
              }}
              placeholder="Paste prompt or benchmark challenge..."
              className="flex-1 bg-transparent text-xs sm:text-sm font-bold text-black focus:outline-none placeholder-[#888]"
            />
            <Paperclip className="w-5 h-5 text-black shrink-0 hidden sm:block" />
          </div>

          {/* Yellow Square Action Button matching screenshot [+] */}
          <button
            onClick={handleRunInference}
            disabled={isLoading || !prompt.trim() || !canGenerate}
            className="w-13 h-13 sm:w-14 sm:h-14 bg-[#FFDE00] hover:bg-[#FFE838] border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] flex items-center justify-center font-black text-2xl text-black neo-btn shrink-0 disabled:opacity-50"
            title="Run Evaluation"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-3 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Plus className="w-7 h-7 stroke-[3]" />
            )}
          </button>
        </div>
      </div>

      <div className="bg-white border-2 border-black rounded-2xl p-3 shadow-[3px_3px_0px_#000] text-xs font-bold">
        <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={useGraphifyContext} disabled={!isOllama || isLoading} onChange={e=>setUseGraphifyContext(e.target.checked)} className="accent-black w-4 h-4" />
          <span>Use Graphify context</span>
        </label>
        <a href="/api/graphify/explore" target="_blank" rel="noopener noreferrer" className="ml-auto px-3 py-1.5 bg-[#FFDE00] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] neo-btn text-xs font-black" title="Open the interactive repository map in a new tab">Explore code graph ↗</a>
        <span className="bg-[#FFE277] border border-black rounded px-2 py-0.5 text-[10px]">LOCAL CODE GRAPH</span>
        </div>
        <p className="mt-2 text-[#555]">{!isOllama ? 'Switch to Ollama to use repository context.' : useGraphifyContext ? 'Both models receive the same graph relationships and source excerpts from BlendLab.' : 'Enable to ground coding answers in this project’s source code.'}</p>
        {isLoading && useGraphifyContext && <p role="status" className="mt-2">Retrieving repository context and generating responses…</p>}
        {graphifyContext && <details className="mt-3 border-t-2 border-black/10 pt-2">
          <summary className="cursor-pointer">Graphify evidence used: {graphifyContext.sources.length} source excerpts · {graphifyContext.retrievalMs} ms retrieval</summary>
          <p className="mt-2 text-[#555]">Indexed {new Date(graphifyContext.indexedAt).toLocaleString()}. Static relationships do not replace tests.</p>
          {graphifyContext.truncated && <p>Graph output shortened to fit the context budget.</p>}
          {graphifyContext.sources.map(source=><div key={source.file+':'+source.line} className="mt-3">
            <p className="font-mono break-all">{source.file}:{source.line} · {source.symbol}</p>
            {source.changedSinceIndex && <p className="text-red-700">Source changed since indexing. Run npm run graphify:index.</p>}
            <pre className="mt-1 p-2 bg-[#FAFAF8] border border-black rounded-lg overflow-x-auto font-mono text-[11px] font-normal">{source.snippet}</pre>
          </div>)}
          <details className="mt-3"><summary className="cursor-pointer">Graph relationships sent to models</summary><pre className="mt-2 p-2 bg-[#FAFAF8] border border-black rounded-lg whitespace-pre-wrap break-words font-mono text-[11px] font-normal">{graphifyContext.text}</pre></details>
        </details>}
      </div>

      {/* Preset Challenge Folder Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-black text-black mr-1">
          Preset Challenges:
        </span>
        {promptPresets.map((preset) => {
          const Icon = preset.icon;
          return (
            <button
              key={preset.label}
              onClick={() => setPrompt(preset.text)}
              className="relative px-3.5 py-1.5 bg-white border-2 border-black rounded-xl text-xs font-black text-black shadow-[2px_2px_0px_#000] neo-btn flex items-center gap-1.5 hover:bg-[#FFF8E6]"
            >
              <span
                className="w-2.5 h-2.5 rounded-sm border border-black"
                style={{ backgroundColor: preset.color }}
              />
              <span>{preset.label}</span>
            </button>
          );
        })}
      </div>

      {/* View Switcher Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-black">Layout:</span>
          <button
            onClick={() => setViewMode('duo')}
            className={`px-3 py-1 text-xs font-black rounded-lg border-2 border-black neo-btn ${
              viewMode === 'duo'
                ? 'bg-black text-white shadow-[2px_2px_0px_#000]'
                : 'bg-white text-black shadow-[2px_2px_0px_#000]'
            }`}
          >
            Candidate vs Source A
          </button>
          <button
            onClick={() => setViewMode('trio')}
            className={`px-3 py-1 text-xs font-black rounded-lg border-2 border-black neo-btn ${
              viewMode === 'trio'
                ? 'bg-black text-white shadow-[2px_2px_0px_#000]'
                : 'bg-white text-black shadow-[2px_2px_0px_#000]'
            }`}
          >
            All 3 Side-by-Side
          </button>
        </div>

        <div className="text-xs font-mono font-bold text-black hidden sm:block">
          Candidate speed: <strong>{formatMetric(responses.candidate.tokPerSec, ' tok/s')}</strong>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-[#FF4F84]/20 border-2 border-black shadow-[3px_3px_0px_#000] text-black font-bold flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-black shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={handleRunInference}
            className="px-3 py-1 bg-black text-white rounded-lg font-black neo-btn"
          >
            Retry
          </button>
        </div>
      )}

      {/* Side-by-Side Response Cards in Neo-Brutalist Folder Styling */}
      <div className={`grid gap-6 ${
        viewMode === 'trio' 
          ? 'grid-cols-1 lg:grid-cols-3' 
          : 'grid-cols-1 lg:grid-cols-2'
      }`}>
        {/* Source Model A Card */}
        <div>
          <div className="w-24 h-3.5 bg-[#FFE277] border-t-2 border-x-2 border-black rounded-t-lg ml-3"></div>
          <div className="bg-white border-2 border-black rounded-2xl rounded-tl-none p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between min-h-[300px]">
            <div>
              <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                <div>
                  <h4 className="font-display font-black text-base text-black">
                    {responses.sourceA.modelName}
                  </h4>
                  <p className="text-[11px] font-bold text-[#666]">
                    {responses.sourceA.roleName}
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(responses.sourceA.text, 'sourceA')}
                  className="px-3 py-1 bg-white border-2 border-black rounded-lg text-xs font-black shadow-[2px_2px_0px_#000] neo-btn flex items-center gap-1"
                >
                  {copiedKey === 'sourceA' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-black" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-black" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="py-4 text-xs font-sans text-black leading-relaxed whitespace-pre-wrap">
                {responses.sourceA.status === 'loading' ? (
                  <div className="space-y-2 py-4 animate-pulse">
                    <div className="h-3.5 bg-black/10 rounded w-5/6"></div>
                    <div className="h-3.5 bg-black/10 rounded w-4/6"></div>
                    <div className="h-3.5 bg-black/10 rounded w-full"></div>
                  </div>
                ) : responses.sourceA.status === 'error' ? (
                  <span className="text-[#C0392B]">{responses.sourceA.error}</span>
                ) : (
                  responses.sourceA.text
                )}
              </div>
            </div>

            <div className="pt-3 border-t-2 border-black/10 text-[11px] font-mono font-bold text-[#444] flex flex-wrap gap-x-2 gap-y-1">
              <span>Input {formatMetric(responses.sourceA.inputTokens, ' tokens')}</span>
              <span>Output {formatMetric(responses.sourceA.outputTokens, ' tokens')}</span>
              <span>{formatMetric(responses.sourceA.tokPerSec, ' tok/s')}</span>
              <span>Wall {formatMetric(responses.sourceA.latencyMs, ' ms')}</span>
              <span>Ollama total {formatMetric(responses.sourceA.ollamaTotalMs, ' ms')}</span>
              <span>Generation {formatGeneration(responses.sourceA)}</span>
            </div>
          </div>
        </div>

        {/* Candidate Blend Model Card (Highlighted with Hot Pink tab & NEW badge!) */}
        <div>
          <div className="w-28 h-3.5 bg-[#FFDE00] border-t-2 border-x-2 border-black rounded-t-lg ml-3"></div>
          <div className="bg-white border-2 border-black rounded-2xl rounded-tl-none p-5 shadow-[6px_6px_0px_#000] ring-2 ring-black flex flex-col justify-between min-h-[300px]">
            <div>
              <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-display font-black text-base text-black">
                      {responses.candidate.modelName}
                    </h4>
                    <span className="text-[10px] font-black bg-[#FF4F84] text-white px-2 py-0.5 rounded-md border border-black shadow-[1px_1px_0px_#000]">
                      {responses.candidate.provenance === 'routed' ? 'ROUTED' : isOllama ? 'OLLAMA' : 'DEMO'}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold font-mono text-[#555]">
                    {responses.candidate.roleName}
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(responses.candidate.text, 'candidate')}
                  className="px-3.5 py-1.5 bg-[#FFDE00] border-2 border-black rounded-lg text-xs font-black shadow-[2px_2px_0px_#000] neo-btn flex items-center gap-1 text-black"
                >
                  {copiedKey === 'candidate' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-black" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-black" />
                      <span>Copy answer</span>
                    </>
                  )}
                </button>
              </div>

              <div className="py-4 text-xs font-sans text-black leading-relaxed whitespace-pre-wrap">
                {responses.candidate.status === 'loading' ? (
                  <div className="space-y-3 py-6 animate-pulse">
                    <div className="h-4 bg-black/15 rounded w-3/4"></div>
                    <div className="h-3.5 bg-black/15 rounded w-5/6"></div>
                    <div className="h-20 bg-black/5 rounded-xl border-2 border-black/10 p-3"></div>
                    <div className="h-3.5 bg-black/15 rounded w-2/3"></div>
                  </div>
                ) : responses.candidate.status === 'error' ? (
                  <span className="text-[#C0392B]">{responses.candidate.error}</span>
                ) : (
                  responses.candidate.text
                )}
              </div>
            </div>

            <div className="pt-3 border-t-2 border-black/10 text-[11px] font-mono font-bold text-black flex flex-wrap gap-x-2 gap-y-1">
              <span className="bg-[#FFDE00] px-1.5 py-0.5 rounded border border-black font-black">
                Input {formatMetric(responses.candidate.inputTokens, ' tokens')} · Output {formatMetric(responses.candidate.outputTokens, ' tokens')}
              </span>
              <span>{formatMetric(responses.candidate.tokPerSec, ' tok/s')}</span>
              <span>Wall {formatMetric(responses.candidate.latencyMs, ' ms')}</span>
              <span>Ollama total {formatMetric(responses.candidate.ollamaTotalMs, ' ms')}</span>
              <span>Generation {formatGeneration(responses.candidate)}</span>
              <span className="bg-[#38E05A] text-black px-1.5 py-0.5 rounded border border-black font-black">{candidateOrigin}</span>
            </div>
          </div>
        </div>

        {/* Source Model B Card (If Trio mode) */}
        {viewMode === 'trio' && (
          <div>
            <div className="w-24 h-3.5 bg-[#38E05A] border-t-2 border-x-2 border-black rounded-t-lg ml-3"></div>
            <div className="bg-white border-2 border-black rounded-2xl rounded-tl-none p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between min-h-[300px]">
              <div>
                <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                  <div>
                    <h4 className="font-display font-black text-base text-black">
                      {responses.sourceB.modelName}
                    </h4>
                    <p className="text-[11px] font-bold text-[#666]">
                    {responses.sourceB.roleName}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(responses.sourceB.text, 'sourceB')}
                    className="px-3 py-1 bg-white border-2 border-black rounded-lg text-xs font-black shadow-[2px_2px_0px_#000] neo-btn flex items-center gap-1"
                  >
                    {copiedKey === 'sourceB' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-black" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-black" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="py-4 text-xs font-sans text-black leading-relaxed whitespace-pre-wrap">
                  {responses.sourceB.status === 'loading' ? (
                    <div className="space-y-2 py-4 animate-pulse">
                      <div className="h-3.5 bg-black/10 rounded w-5/6"></div>
                      <div className="h-3.5 bg-black/10 rounded w-4/6"></div>
                      <div className="h-3.5 bg-black/10 rounded w-full"></div>
                    </div>
                  ) : responses.sourceB.status === 'error' ? (
                    <span className="text-[#C0392B]">{responses.sourceB.error}</span>
                  ) : (
                    responses.sourceB.text
                  )}
                </div>
              </div>

              <div className="pt-3 border-t-2 border-black/10 text-[11px] font-mono font-bold text-[#444] flex flex-wrap gap-x-2 gap-y-1">
                <span>Input {formatMetric(responses.sourceB.inputTokens, ' tokens')}</span>
                <span>Output {formatMetric(responses.sourceB.outputTokens, ' tokens')}</span>
                <span>{formatMetric(responses.sourceB.tokPerSec, ' tok/s')}</span>
                <span>Wall {formatMetric(responses.sourceB.latencyMs, ' ms')}</span>
                <span>Ollama total {formatMetric(responses.sourceB.ollamaTotalMs, ' ms')}</span>
                <span>Generation {formatGeneration(responses.sourceB)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-xs font-bold text-[#555]">
        {isOllama ? 'Responses come from installed Ollama models. The routed candidate reuses the selected source output; no weights are merged.' : 'Demo responses are simulated.'}
      </p>
    </div>
  );
};
