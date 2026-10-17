import React from 'react';
import { ModelInfo, MergeMethod } from '../types';
import { BookOpen, Code2, ArrowRight, Sparkles, Sliders } from 'lucide-react';

interface BlendSliderProps {
  isOllama?: boolean;
  modelA: ModelInfo;
  modelB: ModelInfo;
  ratioB: number;
  onChangeRatioB: (ratio: number) => void;
  mergeMethod: MergeMethod;
  onChangeMethod: (method: MergeMethod) => void;
  candidateTag: string;
  contextUsed: number | null;
  maxContext: number;
  onOpenModelSelectA?: () => void;
  onOpenModelSelectB?: () => void;
}

export const BlendSlider: React.FC<BlendSliderProps> = ({
  isOllama = false,
  modelA,
  modelB,
  ratioB,
  onChangeRatioB,
  mergeMethod,
  onChangeMethod,
  candidateTag,
  contextUsed,
  maxContext,
  onOpenModelSelectA,
  onOpenModelSelectB
}) => {
  const ratioA = 100 - ratioB;
  const discreteSteps = [0, 25, 40, 50, 75, 100];

  return (
    <div className="space-y-4">
      {/* Top Method Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-[#38E05A] border border-black rounded-sm"></span>
          <span className="font-mono text-xs font-black uppercase text-black">
            Candidate: {candidateTag}
          </span>
        </div>

        {/* Merge method pill buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto" hidden={isOllama} style={isOllama ? { display: 'none' } : undefined}>
          <span className="text-[11px] font-black text-black hidden sm:inline">
            Algorithm:
          </span>
          {(['slerp', 'linear', 'ties', 'attention_only'] as MergeMethod[]).map((m) => (
            <button
              key={m}
              onClick={() => onChangeMethod(m)}
              className={`px-3 py-1 rounded-lg text-xs font-black border-2 border-black neo-btn capitalize transition-all ${
                mergeMethod === m
                  ? 'bg-black text-white shadow-[2px_2px_0px_#000]'
                  : 'bg-[#FAFAF8] text-black shadow-[2px_2px_0px_#000] hover:bg-[#FFE277]'
              }`}
            >
              {m.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Column Stage: Model A Folder Card <---> Slider <---> Model B Folder Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Model A Folder Card (styled like "Learning & Research" folder card in screenshot) */}
        <div className="lg:col-span-4 cursor-pointer group" onClick={onOpenModelSelectA}>
          {/* Top Folder Tab */}
          <div className="w-20 h-3.5 bg-[#FFE277] border-t-2 border-x-2 border-black rounded-t-lg ml-3"></div>
          {/* Main Card */}
          <div className="bg-white border-2 border-black rounded-2xl rounded-tl-none p-4 shadow-[4px_4px_0px_#000] group-hover:-translate-y-0.5 transition-transform">
            <div className="flex items-start justify-between">
              {/* Icon Box */}
              <div className="w-12 h-12 rounded-xl bg-[#FFE277] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                <BookOpen className="w-6 h-6 text-black" />
              </div>
              {/* Ratio badge */}
              <div className="text-right">
                <span className="text-xs font-black font-mono bg-black text-white px-2.5 py-0.5 rounded-md border border-black">
                  {ratioA}%
                </span>
                <span className="block text-[10px] font-bold text-[#666] mt-0.5">
                  Source Model A
                </span>
              </div>
            </div>

            <h3 className="font-display font-black text-base text-black mt-3 truncate group-hover:text-[#D96B27]">
              {modelA.name}
            </h3>
            <p className="text-xs text-[#555] line-clamp-1 mt-0.5">
              {modelA.description}
            </p>

            <div className="mt-3 pt-2 border-t border-black/10 flex items-center justify-between text-[11px] font-bold text-[#666]">
              <span>{modelA.parameterCount} params</span>
              <span className="text-black group-hover:underline flex items-center gap-1">
                Switch <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* Center: Slider Bar */}
        <div className="lg:col-span-4 bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_#000]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase text-black">
              {isOllama ? 'Model Routing Ratio' : 'Weight Blend Ratio'}
            </span>
            <span className="font-mono text-xs font-black bg-[#FFDE00] border-2 border-black px-2 py-0.5 rounded-md shadow-[1px_1px_0px_#000]">
              {ratioB}% B
            </span>
          </div>

          <div className="relative py-2">
            <input
              type="range"
              min="0"
              max="100"
              value={ratioB}
              onChange={(e) => onChangeRatioB(Number(e.target.value))}
              className="w-full h-3 bg-[#EAEAE5] border-2 border-black rounded-lg accent-[#000000] cursor-pointer"
            />
          </div>

          {/* Snap Buttons */}
          <div className="flex items-center justify-between gap-1 mt-2">
            {discreteSteps.map((step) => (
              <button
                key={step}
                onClick={() => onChangeRatioB(step)}
                className={`flex-1 py-1 text-[11px] font-black rounded-md border-2 border-black neo-btn transition-all ${
                  ratioB === step
                    ? 'bg-black text-white shadow-[1px_1px_0px_#000]'
                    : 'bg-[#FAFAF8] text-black shadow-[1px_1px_0px_#000] hover:bg-[#FFE277]'
                }`}
              >
                {step}%
              </button>
            ))}
          </div>
          {isOllama && (
            <p className="mt-2 text-[10px] font-bold text-[#555]">
              Routes entirely to {ratioB > 50 ? 'Model B' : 'Model A'} at this setting; no weights are blended.
            </p>
          )}
        </div>

        {/* Model B Folder Card (styled like "Must watch" green folder card in screenshot) */}
        <div className="lg:col-span-4 cursor-pointer group" onClick={onOpenModelSelectB}>
          {/* Top Folder Tab */}
          <div className="w-20 h-3.5 bg-[#38E05A] border-t-2 border-x-2 border-black rounded-t-lg ml-3"></div>
          {/* Main Card */}
          <div className="bg-white border-2 border-black rounded-2xl rounded-tl-none p-4 shadow-[4px_4px_0px_#000] group-hover:-translate-y-0.5 transition-transform">
            <div className="flex items-start justify-between">
              {/* Icon Box */}
              <div className="w-12 h-12 rounded-xl bg-[#38E05A] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                <Code2 className="w-6 h-6 text-black" />
              </div>
              {/* Ratio badge */}
              <div className="text-right">
                <span className="text-xs font-black font-mono bg-black text-white px-2.5 py-0.5 rounded-md border border-black">
                  {ratioB}%
                </span>
                <span className="block text-[10px] font-bold text-[#666] mt-0.5">
                  Target Model B
                </span>
              </div>
            </div>

            <h3 className="font-display font-black text-base text-black mt-3 truncate group-hover:text-[#28A745]">
              {modelB.name}
            </h3>
            <p className="text-xs text-[#555] line-clamp-1 mt-0.5">
              {modelB.description}
            </p>

            <div className="mt-3 pt-2 border-t border-black/10 flex items-center justify-between text-[11px] font-bold text-[#666]">
              <span>{modelB.parameterCount} params</span>
              <span className="text-black group-hover:underline flex items-center gap-1">
                Switch <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Context Window & Resources Footer */}
      <div className="p-3 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-black">
        <div className="flex items-center gap-3">
          <span>Context Window:</span>
          <div className="w-36 h-3 bg-[#EAEAE5] border-2 border-black rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#FFDE00]"
              style={{ width: `${contextUsed !== null && maxContext > 0 ? Math.min(100, (contextUsed / maxContext) * 100) : 0}%` }}
            />
          </div>
          <span className="font-mono">{contextUsed === null ? 'N/A' : contextUsed} / {maxContext || 'model default'} tok</span>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span>Footprint: <strong>{isOllama ? 'managed by Ollama' : '14.2 GB VRAM (demo)'}</strong></span>
          <span>Quant: <strong>{modelA.defaultQuantization}</strong></span>
          {!isOllama && <span>Demo throughput: <strong className="text-[#2ECC71]">~22.5 tok/s</strong></span>}
        </div>
      </div>
    </div>
  );
};
