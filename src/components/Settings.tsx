import React, { useState } from 'react';
import { SettingsState, ModelInfo } from '../types';
import { 
  Settings as SettingsIcon, 
  Server, 
  Cpu, 
  RefreshCw, 
  ShieldCheck, 
  Sliders
} from 'lucide-react';

interface SettingsProps {
  settings: SettingsState;
  onUpdateSettings: (newSettings: Partial<SettingsState>) => void;
  onTestConnection: (url: string) => Promise<{ success: boolean; message: string }>;
  models: ModelInfo[];
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onUpdateSettings,
  onTestConnection,
  models
}) => {
  const [fastApiUrl, setFastApiUrl] = useState(settings.fastApiUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await onTestConnection(fastApiUrl);
      setTestResult(res);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-black text-2xl text-black">
                BLEND-LAB System Settings
              </h2>
              <span className="text-[10px] font-black bg-[#FFE277] border border-black px-2 py-0.5 rounded shadow-[1px_1px_0px_#000]">
                CORE CONFIG
              </span>
            </div>
            <p className="text-xs font-bold text-[#555] mt-0.5">
              Decoupled API service configuration, local runtime prober, and hyperparameter controls.
            </p>
          </div>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Backend API Engine */}
        <div className="lg:col-span-6 bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b-2 border-black/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-black" />
                <h3 className="font-display font-black text-base text-black">
                  Ollama API Connection
                </h3>
              </div>
              <span className="text-[10px] font-black bg-[#38E05A] text-black px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000]">
                {settings.backendMode === 'mock' ? 'DEMO' : settings.connectionStatus === 'connected_api' ? 'CONNECTED' : 'OLLAMA'}
              </span>
            </div>

            <div className="my-4 text-xs font-bold space-y-4">
              <p className="text-[#444] leading-relaxed">
                The local API bridge connects to Ollama. Set OLLAMA_URL on the server to change the Ollama host. No models are downloaded automatically.
              </p>

              <div>
                <label className="block text-black mb-1">
                  BlendLab API URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={fastApiUrl}
                    onChange={(e) => { setFastApiUrl(e.target.value); onUpdateSettings({ fastApiUrl: e.target.value }); }}
                    placeholder="/api/ollama"
                    className="flex-1 bg-[#FAFAF8] border-2 border-black rounded-xl p-2.5 text-xs font-mono text-black focus:outline-none"
                  />
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="px-4 py-2.5 bg-black text-white rounded-xl border-2 border-black font-black neo-btn flex items-center gap-1.5 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>Probe</span>
                  </button>
                </div>
              </div>

              <label className="block">Inference mode
                <select aria-label="Inference mode" value={settings.backendMode} onChange={e => onUpdateSettings({ backendMode: e.target.value as 'ollama' | 'mock' })} className="ml-3 border-2 border-black rounded p-2">
                  <option value="ollama">Ollama (local and cloud models)</option>
                  <option value="mock">Demo (simulated)</option>
                </select>
              </label>
              <label className="block">Request timeout (seconds)
                <input aria-label="Request timeout" type="number" min="1" max="600" value={settings.requestTimeoutSeconds} onChange={e => onUpdateSettings({ requestTimeoutSeconds: Number(e.target.value) })} className="ml-3 w-24 border-2 border-black rounded p-2" />
              </label>

              {testResult && (
                <div className="p-3 bg-[#FAFAF8] border-2 border-black rounded-xl text-xs font-bold">
                  {testResult.message}
                </div>
              )}

              <div className="p-3 bg-[#FAFAF8] border-2 border-black rounded-xl space-y-1 font-mono text-[11px]">
                <div className="font-black text-black uppercase text-[10px]">
                  Service Flow:
                </div>
                <div>React UI → BlendLab API → Ollama</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t-2 border-black/10 flex items-center justify-between text-xs font-bold text-[#666]">
            <span>Timeout: <strong>{settings.requestTimeoutSeconds}s</strong></span>
            <span>Models managed by Ollama</span>
          </div>
        </div>

        {/* Right: Hyperparameters */}
        <div className="lg:col-span-6 bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b-2 border-black/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-black" />
                <h3 className="font-display font-black text-base text-black">
                  Inference Hyperparameters
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-[#666]">
                Sampling Defaults
              </span>
            </div>

            <div className="my-4 space-y-4 text-xs font-bold">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-black">
                    Temperature: <span className="font-mono">{settings.defaultTemperature}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={settings.defaultTemperature}
                    onChange={(e) => onUpdateSettings({ defaultTemperature: Number(e.target.value) })}
                    className="w-full accent-black"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-black">
                    Top-P: <span className="font-mono">{settings.defaultTopP}</span>
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={settings.defaultTopP}
                    onChange={(e) => onUpdateSettings({ defaultTopP: Number(e.target.value) })}
                    className="w-full accent-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-black">Max Tokens</label>
                  <input
                    type="number"
                    value={settings.defaultMaxTokens}
                    onChange={(e) => onUpdateSettings({ defaultMaxTokens: Number(e.target.value) })}
                    className="w-full bg-[#FAFAF8] border-2 border-black rounded-xl p-2 font-mono text-black focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-black">Sample Count</label>
                  <input
                    type="number"
                    value={settings.defaultBenchmarkSamples}
                    onChange={(e) => onUpdateSettings({ defaultBenchmarkSamples: Number(e.target.value) })}
                    className="w-full bg-[#FAFAF8] border-2 border-black rounded-xl p-2 font-mono text-black focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#FAFAF8] border-2 border-black rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled
                    checked={false}
                    onChange={(e) => onUpdateSettings({ enableSafetyChecks: e.target.checked })}
                    className="accent-black w-4 h-4 rounded"
                  />
                  <span>Alignment guardrails (not implemented)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled
                    checked={false}
                    onChange={(e) => onUpdateSettings({ autoSaveExperiments: e.target.checked })}
                    className="accent-black w-4 h-4 rounded"
                  />
                  <span>Auto-save generations (not implemented)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t-2 border-black/10 flex items-center justify-between text-xs font-bold text-[#666]">
            <span>Quantization managed by Ollama</span>
            <span className="text-black font-black">Persisted in local state</span>
          </div>
        </div>
      </div>

      {/* Model Catalog */}
      <div className="bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000]">
        <h3 className="font-display font-black text-base text-black mb-3">
          Configured Open Models Catalog
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-bold">
            <thead>
              <tr className="border-b-2 border-black/15 text-black">
                <th className="py-2 px-3">Model Name</th>
                <th className="py-2 px-3">Architecture</th>
                <th className="py-2 px-3">Parameters</th>
                <th className="py-2 px-3">Context</th>
                <th className="py-2 px-3">Specialization</th>
                <th className="py-2 px-3">Quantization</th>
              </tr>
            </thead>
            <tbody className="divide-y border-b border-black/10">
              {models.map((m) => (
                <tr key={m.id} className="hover:bg-[#FAFAF8]">
                  <td className="py-3 px-3 font-black text-black">{m.name}</td>
                  <td className="py-3 px-3 text-[#555]">{m.architecture}</td>
                  <td className="py-3 px-3 font-mono">{m.parameterCount}</td>
                  <td className="py-3 px-3 font-mono">{m.contextWindow ? `${m.contextWindow.toLocaleString()} tok` : 'Model default'}</td>
                  <td className="py-3 px-3">
                    <span className="font-mono text-[10px] uppercase bg-[#FFE277] border border-black px-2 py-0.5 rounded">
                      {m.baseSpecialization}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono">{m.defaultQuantization}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
