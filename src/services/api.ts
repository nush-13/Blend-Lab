import {
  ModelInfo,
  BlendConfiguration,
  BenchmarkDefinition,
  BenchmarkRun,
  BenchmarkRunRequest,
  BlendPilotRequest,
  BlendPilotRecommendationResult,
  Experiment,
  ExperimentComparison,
  ModelResponse,
  GraphifyContext,
  SettingsState
} from '../types';

// ==========================================
// MODELS CATALOG
// ==========================================
export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'gemma-1.1-7b-it',
    name: 'GEMMA-1.1-7B-IT',
    family: 'Gemma',
    parameterCount: '8.54B',
    contextWindow: 8192,
    architecture: 'Dense Decoder-only Transformer',
    baseSpecialization: 'writing',
    defaultQuantization: 'Q4_K_M',
    tags: ['Lyrical Prose', 'Creative Writing', 'Instruction Follow'],
    description: 'Tuned for conversational nuances, literary writing, and nuanced reasoning with strict safety guardrails.',
    recommendedRole: 'Model A (Primary)'
  },
  {
    id: 'codegemma-7b-it',
    name: 'CODEGEMMA-7B-IT',
    family: 'Gemma',
    parameterCount: '8.54B',
    contextWindow: 8192,
    architecture: 'Dense Decoder-only Transformer',
    baseSpecialization: 'coding',
    defaultQuantization: 'Q4_K_M',
    tags: ['Python / TS / Rust', 'Algorithm Synthesis', 'Bug Fixing'],
    description: 'Pretrained on 500B tokens of code and syntax-rich corpora, optimized for high HumanEval execution accuracy.',
    recommendedRole: 'Model B (Secondary)'
  },
  {
    id: 'mistral-7b-instruct-v0.3',
    name: 'MISTRAL-7B-INSTRUCT-V0.3',
    family: 'Mistral',
    parameterCount: '7.24B',
    contextWindow: 32768,
    architecture: 'Sliding Window Attention',
    baseSpecialization: 'reasoning',
    defaultQuantization: 'Q5_K_M',
    tags: ['Multi-step Logic', 'Fast Inference', 'Function Calling'],
    description: 'Balanced base reasoning with v0.3 tokenizer and sliding window attention mechanics.',
    recommendedRole: 'Neutral'
  },
  {
    id: 'llama-3-8b-instruct',
    name: 'LLAMA-3-8B-INSTRUCT',
    family: 'Llama 3',
    parameterCount: '8.03B',
    contextWindow: 8192,
    architecture: 'RoPE Grouped-Query Attention',
    baseSpecialization: 'general',
    defaultQuantization: 'Q4_K_M',
    tags: ['General Instruction', 'Math', 'Knowledge Retrieval'],
    description: 'High-generalization weights with high ceiling across multi-domain MMLU and dialogue.',
    recommendedRole: 'Model A (Primary)'
  },
  {
    id: 'starcoder2-7b',
    name: 'STARCODER2-7B',
    family: 'StarCoder',
    parameterCount: '7.0B',
    contextWindow: 16384,
    architecture: 'Multi-Query Decoder',
    baseSpecialization: 'coding',
    defaultQuantization: 'Q4_K_M',
    tags: ['Repo-Level Code', 'Git Commit Synthesizer', 'Low Latency'],
    description: 'Trained on 600+ programming languages from The Stack v2 with long-context fill-in-the-middle support.',
    recommendedRole: 'Model B (Secondary)'
  }
];

// ==========================================
// SERVICE LAYER IMPLEMENTATION
// ==========================================
class BlendLabApiService {
  private settings: SettingsState = {
    backendMode: 'ollama',
    fastApiUrl: '/api/ollama',
    connectionStatus: 'disconnected',
    defaultTemperature: 0.7,
    defaultTopP: 0.9,
    defaultMaxTokens: 1024,
    defaultBenchmarkSamples: 50,
    requestTimeoutSeconds: 180,
    enableSafetyChecks: true,
    autoSaveExperiments: true,
    quantizationDefault: 'Q4_K_M'
  };

  // --- Models ---
  async getModels(): Promise<ModelInfo[]> {
    if (this.settings.backendMode === 'mock') return AVAILABLE_MODELS;
    const data = await this.ollamaRequest('/models');
    return data.models.map((model: any) => ({
      id: model.name, name: model.name, family: model.details?.family || 'Unknown',
      parameterCount: model.details?.parameter_size || 'Unknown', contextWindow: 0,
      architecture: model.details?.format || 'Ollama', baseSpecialization: 'general',
      defaultQuantization: model.details?.quantization_level || 'Unknown',
      tags: ['Installed in Ollama'], description: 'Installed local Ollama model. Context limit is model dependent.',
    }));
  }

  // --- Prompt Playground Generator ---
  async generatePlaygroundResponses(
    prompt: string,
    config: BlendConfiguration
  ): Promise<{
    sourceA: ModelResponse;
    candidate: ModelResponse;
    sourceB: ModelResponse;
    graphifyContext?: GraphifyContext | null;
  }> {
    if (this.settings.backendMode === 'ollama') {
      return this.ollamaRequest('/compare', {
        prompt, modelA: config.modelA.id, modelB: config.modelB.id, ratioB: config.ratioB,
        useGraphifyContext: config.useGraphifyContext ?? false,
        temperature: this.settings.defaultTemperature, topP: this.settings.defaultTopP,
        maxTokens: this.settings.defaultMaxTokens, timeoutSeconds: this.settings.requestTimeoutSeconds,
      });
    }
    // Realistic simulated inference time: 350ms to 700ms
    await this.simulateDelay(550);

    const isPoemPrompt = prompt.toLowerCase().includes('poem') || 
                         prompt.toLowerCase().includes('ballad') || 
                         prompt.toLowerCase().includes('harbour') ||
                         prompt.toLowerCase().includes('rhyme');

    const isCodePrompt = prompt.toLowerCase().includes('python') || 
                         prompt.toLowerCase().includes('code') || 
                         prompt.toLowerCase().includes('function') ||
                         prompt.toLowerCase().includes('rust') ||
                         prompt.toLowerCase().includes('algorithm');

    const ratioB = config.ratioB; // 0 to 100 percentage of Code Model

    let sourceAText = '';
    let candidateText = '';
    let sourceBText = '';

    if (isPoemPrompt) {
      sourceAText = 
`Soft rain on the harbour wall,
the lamps are low, the boats are small,
and every ripple carries slow
the hush of all the tides we know.

The timber creaks against the quay,
a lantern dreams upon the sea,
and through the mist of salt and stone,
the quiet night becomes our own.`;

      sourceBText = 
`def simulate_harbour():
    harbour = {"rain": "soft", "tide": "ebb", "boats": 4}
    for b in range(harbour["boats"]):
        print(f"Boat {b}: secure at quay.")
    return True

simulate_harbour()`;

      if (ratioB <= 25) {
        candidateText = 
`Soft rain on the harbour wall,
the lamps are low, the boats are small,
and every ripple carries slow
the hush of all the tides we know.

The moored boats count in steady pair:
boat_left = True, boat_right = 'secure';
while misty sea-lamps gently glow,
the quiet tide begins to flow.`;
      } else if (ratioB <= 60) {
        candidateText = 
`# Harbour Tide & Lanterns
# Generated with blend ${100 - ratioB}% Gemma + ${ratioB}% CodeGemma

Soft rain taps on the harbour wall,
the lamps burn low, the crafts are small.
Each wooden hull nods in the sea,
in balanced cadence: O(1) free.

\`\`\`python
class MooredVessel:
    def __init__(self, name: str, docked: bool = True):
        self.name = name
        self.weather = "soft rain on quay"
        
    def tide_sound(self) -> str:
        return "hush of all the tides we know"
\`\`\`

The rain relents; the lanterns dim,
the quiet waters reach the brim.`;
      } else {
        candidateText = 
`\`\`\`python
# Harbor ballad procedural rhythm
def harbour_ballad():
    """Outputs atmospheric verse lines."""
    stanzas = [
        "Soft rain on the harbour wall, lamps are low, boats are small.",
        "Timber creaks against the quay, lantern dreams upon the sea."
    ]
    return "\\n".join(stanzas)

print(harbour_ballad())
\`\`\``;
      }
    } else if (isCodePrompt) {
      sourceAText = 
`Here is an approach to solve your request!

When considering this problem, we want to balance elegance and maintainability.
We can define a clean structure that models the data naturally:

\`\`\`python
def process_data(items):
    # Process items with a clear loop
    results = []
    for item in items:
        if item:
            results.append(str(item).strip())
    return results
\`\`\`

Notice how clean and readable this structure is for any collaborator!`;

      sourceBText = 
`\`\`\`python
from typing import List, Optional

def process_data(items: List[Optional[str]]) -> List[str]:
    """
    Time Complexity: O(N)
    Space Complexity: O(N) worst-case
    """
    if not items:
        return []
    return [cleaned for item in items if item is not None and (cleaned := item.strip())]
\`\`\``;

      candidateText = 
`Here is an optimized, production-ready solution with clean typed annotations and clear architectural reasoning:

\`\`\`python
from typing import List, Optional

def process_data(items: List[Optional[str]]) -> List[str]:
    """
    Filters and normalizes input strings with full null-safety.
    
    Complexity: O(N) linear time, O(k) memory for filtered elements.
    """
    if not items:
        return []
        
    return [
        normalized 
        for item in items 
        if item is not None and (normalized := item.strip())
    ]
\`\`\`

### Key Observations
1. **Walrus Operator Assignment**: \`(normalized := item.strip())\` prevents double invocation of string manipulation.
2. **Type Signatures**: Clear distinction between \`Optional[str]\` and guaranteed output \`List[str]\`.`;
    } else {
      sourceAText = 
`When we examine this question, the key nuance lies in context and intentionality.
Every perspective brings its own texture: on one hand, clarity requires simplicity; on the other hand, depth requires embracing subtle ambiguities. 

In everyday practice, the most resilient approach is one of continuous reflection and gentle calibration.`;

      sourceBText = 
`1. Definition: The entity under review requires systematic evaluation of preconditions and output invariants.
2. Method: Validate constraints, execute transformation pipeline, catch exceptions.
3. Metric: Execution time <= 200ms, memory <= 64MB.`;

      candidateText = 
`When structuring this approach, we can combine conceptual clarity with concrete execution steps:

1. **Strategic Intent**: Establish clear boundary conditions and intentional goals before applying transformations.
2. **Systematic Pipeline**: Verify inputs against defined schemas and ensure invariants hold across all stages.
3. **Calibrated Delivery**: Maintain a readable, human-centric presentation while tracking concrete latency and memory constraints.`;
    }

    const sourceA: ModelResponse = {
      modelName: config.modelA.name,
      roleName: 'Demo · Model A',
      text: sourceAText,
      status: 'demo', provenance: 'demo', error: null,
      inputTokens: null, outputTokens: null, tokPerSec: null, latencyMs: null,
      generationMs: null, ollamaTotalMs: null, promptProcessingMs: null, loadMs: null,
      timestamp: new Date().toLocaleTimeString(),
      contextUsed: null
    };

    const candidate: ModelResponse = {
      modelName: `${config.candidateName} (${config.ratioB}% demo)`,
      roleName: `Simulated candidate · ${config.ratioB}%`,
      text: candidateText,
      status: 'demo', provenance: 'demo', error: null,
      inputTokens: null, outputTokens: null, tokPerSec: null, latencyMs: null,
      generationMs: null, ollamaTotalMs: null, promptProcessingMs: null, loadMs: null,
      timestamp: new Date().toLocaleTimeString(),
      contextUsed: null
    };

    const sourceB: ModelResponse = {
      modelName: config.modelB.name,
      roleName: 'Demo · Model B',
      text: sourceBText,
      status: 'demo', provenance: 'demo', error: null,
      inputTokens: null, outputTokens: null, tokPerSec: null, latencyMs: null,
      generationMs: null, ollamaTotalMs: null, promptProcessingMs: null, loadMs: null,
      timestamp: new Date().toLocaleTimeString(),
      contextUsed: null
    };

    return { sourceA, candidate, sourceB };
  }

  // --- Benchmarks Data ---
  async getBenchmarkDefinitions(): Promise<BenchmarkDefinition[]> {
    const data = await this.ollamaRequest('/benchmarks');
    return data.benchmarks;
  }

  async getBenchmarkRuns(): Promise<BenchmarkRun[]> {
    const data = await this.ollamaRequest('/benchmark-runs');
    return data.runs;
  }

  async getBenchmarkRun(runId: string): Promise<BenchmarkRun> {
    return this.ollamaRequest(`/benchmark-runs/${encodeURIComponent(runId)}`);
  }

  async startBenchmarkRun(request: BenchmarkRunRequest): Promise<BenchmarkRun> {
    return this.ollamaRequest('/benchmark-runs', request);
  }

  async getBlendPilotRecommendation(request: BlendPilotRequest): Promise<BlendPilotRecommendationResult> {
    return this.ollamaRequest('/blendpilot/recommendation', request);
  }

  // --- Experiments ---
  async getExperiments(): Promise<Experiment[]> {
    const data = await this.ollamaRequest('/experiments');
    return data.experiments;
  }

  async saveExperiment(input: { name: string; description: string; runId: string }): Promise<Experiment> {
    return this.ollamaRequest('/experiments', input);
  }

  async deleteExperiment(id: string): Promise<void> {
    await this.ollamaRequest(`/experiments/${encodeURIComponent(id)}`, undefined, 'DELETE');
  }

  async compareExperiments(experimentIds: [string, string]): Promise<ExperimentComparison> {
    return this.ollamaRequest('/experiments/compare', { experimentIds });
  }

  // --- Settings ---
  getSettings(): SettingsState {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<SettingsState>): SettingsState {
    this.settings = { ...this.settings, ...partial };
    return { ...this.settings };
  }

  async testBackendConnection(url: string): Promise<{ success: boolean; message: string }> {
    this.updateSettings({ fastApiUrl: url });
    try {
      const data = await this.ollamaRequest('/models');
      this.updateSettings({ connectionStatus: 'connected_api' });
      return { success: true, message: `Connected to Ollama. ${data.models.length} installed model(s).` };
    } catch (error) {
      this.updateSettings({ connectionStatus: 'disconnected' });
      return { success: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  private async ollamaRequest(endpoint: string, body?: unknown, method?: string): Promise<any> {
    try {
      const response = await fetch(this.settings.fastApiUrl.replace(/\/$/, '') + endpoint, {
        method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout((this.settings.requestTimeoutSeconds + 5) * 1000),
      });
      const data = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') throw new Error('Ollama request timed out. Increase the timeout in Settings.');
      if (error instanceof TypeError) throw new Error('Cannot reach the BlendLab API. Run npm run dev, or npm start after building.');
      throw error;
    }
  }

  // Helper
  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const apiService = new BlendLabApiService();
