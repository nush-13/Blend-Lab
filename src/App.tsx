import React, { useState, useEffect } from 'react';
import { 
  ModelInfo, 
  MergeMethod, 
  BlendConfiguration, 
  Experiment, 
  SettingsState,
  ActiveTab
} from './types';
import { apiService, AVAILABLE_MODELS } from './services/api';
import { Navigation } from './components/Navigation';
import { Playground } from './components/Playground';
import { CapabilityCurve } from './components/CapabilityCurve';
import { BlendPilotEvidence as BlendPilot } from './components/BlendPilotEvidence';
import { Benchmarks } from './components/BenchmarksRunner';
import { Experiments } from './components/Experiments';
import { Settings } from './components/Settings';
import { ModelSelectorModal } from './components/ModelSelectorModal';
import { AboutModal } from './components/AboutModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('playground');
  const [benchmarkRunToOpen, setBenchmarkRunToOpen] = useState('');

  // Active models & blend config
  const [modelA, setModelA] = useState<ModelInfo>(AVAILABLE_MODELS[0]); // Gemma 1.1 7B
  const [modelB, setModelB] = useState<ModelInfo>(AVAILABLE_MODELS[1]); // CodeGemma 7B
  const [ratioB, setRatioB] = useState<number>(40); // 40% Code, 60% Writing
  const [mergeMethod, setMergeMethod] = useState<MergeMethod>('slerp');

  // Experiments data
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [experimentLoadError, setExperimentLoadError] = useState('');

  // Settings data
  const [settings, setSettings] = useState<SettingsState>(apiService.getSettings());
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelError, setModelError] = useState('');
  const [modelsLoading, setModelsLoading] = useState(false);
  const refreshModels = async () => {
    setModelsLoading(true);
    setModelError('');
    try {
      const models = await apiService.getModels();
      setAvailableModels(models);
      if (!models.length) setModelError('Ollama has no installed models. Install a model in Ollama, then refresh.');
      if (models.length) {
        setModelA(previous => models.find(m => m.id === previous.id) || models[0]);
        setModelB(previous => models.find(m => m.id === previous.id) || models[1] || models[0]);
      }
    } catch (error) {
      setAvailableModels([]);
      setModelError(error instanceof Error ? error.message : 'Cannot load Ollama models.');
    } finally { setModelsLoading(false); }
  };
  useEffect(() => { refreshModels(); }, [settings.backendMode]);

  // Modals
  const [modelSelectSlot, setModelSelectSlot] = useState<'Model A' | 'Model B' | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);

  // Load initial data
  const refreshExperiments = async () => {
    try {
      const saved = await apiService.getExperiments();
      setExperiments(saved);
      setExperimentLoadError('');
    } catch (error) {
      setExperimentLoadError(error instanceof Error ? error.message : 'Could not load saved experiments.');
      throw error;
    }
  };
  useEffect(() => { void refreshExperiments().catch(() => undefined); }, []);

  const handleApplyRatioToPlayground = (ratio: number) => {
    setRatioB(ratio);
    setActiveTab('playground');
  };

  const handleOpenBenchmarkRun = (runId: string) => {
    setBenchmarkRunToOpen(runId);
    setActiveTab('benchmarks');
  };

  return (
    <div className="min-h-screen bg-[#FEDE00] py-4 sm:py-8 px-2 sm:px-6 relative overflow-hidden flex flex-col justify-between selection:bg-[#FF4F84] selection:text-white">
      {/* Decorative Neo-Brutalist Geometric Background Shapes */}
      <div className="absolute top-12 -left-20 w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-[#FF2A85] pointer-events-none -z-0"></div>
      <div className="absolute bottom-0 -right-20 w-72 h-72 sm:w-96 sm:h-96 bg-[#7E69FF] pointer-events-none -z-0 rotate-12"></div>

      {/* Main Neo-Brutalist App Device Container */}
      <div className="relative z-10 max-w-[1280px] w-full mx-auto bg-[#FAFAF8] text-black border-[3px] sm:border-[3.5px] border-black rounded-[32px] sm:rounded-[40px] shadow-[8px_8px_0px_#000000] sm:shadow-[12px_12px_0px_#000000] p-5 sm:p-8 flex flex-col min-h-[92vh]">
        {/* Navigation & Header */}
        <Navigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onResetChat={() => setRatioB(40)}
          onOpenAbout={() => setIsAboutOpen(true)}
        />

        {/* Tab Content Views */}
        <main className="flex-1 mt-2">
          <div className="mb-5 p-3 bg-white border-2 border-black rounded-xl text-xs font-bold flex flex-wrap items-center gap-3">
            <span>{settings.backendMode === 'ollama' ? 'Ollama local inference. Candidate routes to A at 0–50%, B above 50%; no weight merging.' : 'Demo mode: responses are simulated.'} Capability Curve, Benchmarks, BlendPilot, and Experiments use saved benchmark evidence.</span>
            <button className="underline shrink-0" onClick={refreshModels} disabled={modelsLoading}>{modelsLoading ? 'Loading models…' : 'Refresh models'}</button>
            {modelError && <span role="alert" className="text-red-700">{modelError}</span>}
            {experimentLoadError && <span role="alert" className="text-red-700">Saved experiment history unavailable: {experimentLoadError}</span>}
          </div>
          {activeTab === 'playground' && (
            <Playground
              key={`${settings.backendMode}-${modelA.id}-${modelB.id}`}
              isOllama={settings.backendMode === 'ollama'}
              canGenerate={!modelsLoading && availableModels.length > 0}
              modelA={modelA}
              modelB={modelB}
              ratioB={ratioB}
              onChangeRatioB={setRatioB}
              mergeMethod={mergeMethod}
              onChangeMethod={setMergeMethod}
              onOpenModelSelectA={() => setModelSelectSlot('Model A')}
              onOpenModelSelectB={() => setModelSelectSlot('Model B')}
              onGenerateResponses={apiService.generatePlaygroundResponses.bind(apiService)}
            />
          )}

          {activeTab === 'capability' && (
            <CapabilityCurve onOpenRun={handleOpenBenchmarkRun} />
          )}

          {activeTab === 'blendpilot' && (
            <BlendPilot isOllama={settings.backendMode === 'ollama'} />
          )}

          {activeTab === 'benchmarks' && <Benchmarks models={availableModels} isOllama={settings.backendMode === 'ollama'} initialRunId={benchmarkRunToOpen} />}

          {activeTab === 'experiments' && (
            <Experiments
              experiments={experiments}
              onExperimentsChanged={refreshExperiments}
              availableModels={availableModels}
              isOllama={settings.backendMode === 'ollama'}
            />
          )}

          {activeTab === 'settings' && (
            <Settings
              settings={settings}
              onUpdateSettings={(s) => setSettings(apiService.updateSettings(s))}
              onTestConnection={async (url) => { const result = await apiService.testBackendConnection(url); setSettings(apiService.getSettings()); await refreshModels(); return result; }}
              models={availableModels}
            />
          )}
        </main>

        {/* Minimal Neo-Brutalist Footer */}
        <footer className="mt-8 pt-4 border-t-2 border-black/15 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-[#444]">
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-black">BLEND-LAB</span>
            <span>·</span>
            <span>Model Comparison & Regression Laboratory</span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>SLERP / TIES / DARE / Attention Graft</span>
            <span>·</span>
            <button
              onClick={() => setIsAboutOpen(true)}
              className="text-black font-black hover:underline"
            >
              System Guide
            </button>
          </div>
        </footer>
      </div>

      {/* Model Selector Modal */}
      {modelSelectSlot && (
        <ModelSelectorModal
          isOpen={true}
          onClose={() => setModelSelectSlot(null)}
          models={availableModels}
          selectedModelId={modelSelectSlot === 'Model A' ? modelA.id : modelB.id}
          onSelectModel={(model) => {
            if (modelSelectSlot === 'Model A') {
              setModelA(model);
            } else {
              setModelB(model);
            }
          }}
          slotLabel={modelSelectSlot}
        />
      )}

      {/* About Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
    </div>
  );
}

