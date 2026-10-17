import React from 'react';
import { ModelInfo } from '../types';
export function ModelComparisonControls({modelA,modelB,onSelectA,onSelectB,preference,onPreferenceChange,disabled}:{modelA:ModelInfo;modelB:ModelInfo;onSelectA:()=>void;onSelectB:()=>void;preference:'latency'|'throughput';onPreferenceChange:(value:'latency'|'throughput')=>void;disabled:boolean}) {
 return <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
  {[modelA,null,modelB].map((model,index)=>model ? <button key={index} disabled={disabled} onClick={index===0?onSelectA:onSelectB} className="text-left bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_#000] neo-btn">
   <span className={'text-[10px] font-black border border-black rounded px-2 py-1 '+(index===0?'bg-[#FFE277]':'bg-[#38E05A]')}>MODEL {index===0?'A':'B'}</span>
   <h3 className="font-display font-black text-base mt-3 break-all">{model.name}</h3><p className="text-xs font-bold text-[#555] mt-2">{model.parameterCount} · {model.defaultQuantization}</p><span className="text-xs underline font-bold">Change model</span>
  </button>:<div key={index} className="bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_#000]">
   <label className="block text-xs font-black mb-2" htmlFor="answer-preference">Recommend by measured performance</label>
   <select id="answer-preference" disabled={disabled} value={preference} onChange={e=>onPreferenceChange(e.target.value as 'latency'|'throughput')} className="w-full bg-[#FFDE00] border-2 border-black rounded-xl p-2 text-xs font-bold"><option value="latency">Lowest response time</option><option value="throughput">Highest generation speed (tok/s)</option></select>
   <p className="mt-2 text-xs font-bold text-[#555]">Compares successful responses from this run. Speed does not prove answer correctness; model loading and response length affect timing.</p>
  </div>)}
 </div>;
}
