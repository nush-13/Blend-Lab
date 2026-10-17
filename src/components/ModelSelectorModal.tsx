import React from 'react';
import { ModelInfo } from '../types';
import { X, Check } from 'lucide-react';

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: ModelInfo[];
  selectedModelId: string;
  onSelectModel: (model: ModelInfo) => void;
  slotLabel: 'Model A' | 'Model B';
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  isOpen,
  onClose,
  models,
  selectedModelId,
  onSelectModel,
  slotLabel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border-[3px] border-black shadow-[8px_8px_0px_#000] max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in">
        {/* Header */}
        <div className="px-6 py-4 bg-[#FFDE00] border-b-2 border-black flex items-center justify-between">
          <div>
            <h3 className="font-display font-black text-lg text-black">
              Select {slotLabel}
            </h3>
            <p className="text-xs font-bold text-black/80">
              Choose a model for the comparison slot.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white border-2 border-black text-black flex items-center justify-center neo-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Model List */}
        <div className="p-6 overflow-y-auto space-y-3">
          {models.map((model) => {
            const isSelected = model.id === selectedModelId;
            return (
              <div
                key={model.id}
                onClick={() => {
                  onSelectModel(model);
                  onClose();
                }}
                className={`p-4 rounded-xl border-2 border-black cursor-pointer transition-all neo-btn ${
                  isSelected
                    ? 'bg-[#FFE277] shadow-[4px_4px_0px_#000] -translate-y-0.5'
                    : 'bg-white shadow-[2px_2px_0px_#000] hover:bg-[#FAFAF8]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-display font-black text-base text-black">
                        {model.name}
                      </h4>
                      <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-white border border-black">
                        {model.parameterCount}
                      </span>
                      <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-[#38E05A] border border-black uppercase text-black">
                        {model.defaultQuantization}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#555] mt-1">
                      {model.description}
                    </p>
                  </div>
                  <div className="shrink-0 pt-1">
                    {isSelected ? (
                      <span className="w-6 h-6 rounded-lg bg-black text-white flex items-center justify-center border border-black">
                        <Check className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="w-6 h-6 rounded-lg border-2 border-black" />
                    )}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-black/10 flex flex-wrap items-center gap-x-4 text-[11px] font-bold text-[#666]">
                  <span>Family: <strong className="text-black">{model.family}</strong></span>
                  <span>Context: <strong className="text-black">{model.contextWindow} tok</strong></span>
                  <span>Arch: <strong className="text-black">{model.architecture}</strong></span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {model.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-black text-black bg-white border border-black px-2 py-0.5 rounded"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#FAFAF8] border-t-2 border-black flex items-center justify-between text-xs font-bold text-[#555]">
          <span>Choose from the available model catalog</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-black text-white font-black border-2 border-black neo-btn"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
