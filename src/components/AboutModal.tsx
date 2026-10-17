import React from 'react';
import { X, Sparkles } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border-[3px] border-black shadow-[8px_8px_0px_#000] max-w-lg w-full p-6 animate-in fade-in">
        <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFDE00] border-2 border-black flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <div>
              <h3 className="font-display font-black text-base text-black">
                BLEND-LAB
              </h3>
              <p className="text-[11px] font-bold text-[#666]">
                Architecture & Evaluation System
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#FAFAF8] border-2 border-black text-black flex items-center justify-center neo-btn hover:bg-[#FFE277]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="my-4 text-xs font-bold space-y-3 text-[#333] leading-relaxed">
          <p>
            <strong>BLEND-LAB</strong> compares local model responses and saved benchmark evidence. Its Ollama candidate routes to one selected model at a time; it does not merge model weights.
          </p>

          <div className="p-3.5 rounded-xl bg-[#FAFAF8] border-2 border-black space-y-1.5 font-mono text-[11px]">
            <div className="font-black text-black uppercase text-[10px]">
              Key Architecture Features:
            </div>
            <div>• <strong>BlendPilot:</strong> Evidence-based recommendations from saved deterministic benchmark results; insufficient evidence is reported without guessing.</div>
            <div>• <strong>Capability Curves:</strong> Aggregates actual saved benchmark outcomes and measured wall latency; it does not score overall intelligence or blend weights.</div>
            <div>• <strong>Benchmark Harness:</strong> Deterministic checks against discovered Ollama models, with saved per-case outcomes.</div>
            <div>• <strong>Modular API:</strong> Express service connected to local Ollama for model discovery and inference.</div>
          </div>
        </div>

        <div className="pt-3 border-t-2 border-black/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-black text-white text-xs font-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] neo-btn"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
