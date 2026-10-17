export interface ModelInfo {
  id: string;
  name: string;
  family: string;
  parameterCount: string;
  contextWindow: number;
  architecture: string;
  baseSpecialization: 'coding' | 'writing' | 'reasoning' | 'general' | 'instruction';
  defaultQuantization: string;
  tags: string[];
  description: string;
  recommendedRole?: 'Model A (Primary)' | 'Model B (Secondary)' | 'Neutral';
}

export type ActiveTab = 
  | 'playground' 
  | 'capability' 
  | 'blendpilot' 
  | 'benchmarks' 
  | 'experiments' 
  | 'settings';

export type MergeMethod = 
  | 'slerp' 
  | 'linear' 
  | 'ties' 
  | 'dare' 
  | 'task_arithmetic' 
  | 'attention_only' 
  | 'mlp_only';

export interface BlendConfiguration {
  useGraphifyContext?: boolean;
  id: string;
  modelA: ModelInfo;
  modelB: ModelInfo;
  ratioA: number; // 0 to 100
  ratioB: number; // 100 - ratioA
  method: MergeMethod;
  candidateName: string;
  candidateTag: string;
  quantization: string;
  layerWeights?: {
    attention: number;
    mlp: number;
  };
  temperature?: number;
}

export interface ModelResponse {
  modelName: string;
  roleName: string;
  text: string;
  status: 'idle' | 'loading' | 'success' | 'error' | 'demo';
  provenance: 'inference' | 'routed' | 'reused' | 'demo' | 'none';
  measurementSource?: 'sourceA' | 'sourceB';
  routedFrom?: 'sourceA' | 'sourceB';
  reusedFrom?: 'sourceA' | 'sourceB';
  error: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  tokPerSec: number | null;
  latencyMs: number | null;
  generationMs: number | null;
  ollamaTotalMs: number | null;
  promptProcessingMs: number | null;
  loadMs: number | null;
  timestamp: string;
  contextUsed: number | null;
}

export interface TestCase {
  id: string;
  name: string;
  category: 'code' | 'prose' | 'reasoning' | 'instruction' | 'summarization';
  prompt: string;
  groundTruthSnippet?: string;
  criteria: string;
}

export interface BenchmarkSuite {
  id: string;
  name: string;
  description: string;
  sampleCount: number;
  category: 'code' | 'prose' | 'reasoning' | 'instruction' | 'summarization';
  metrics: string[];
  testCases: TestCase[];
}

export interface FailedTestCase {
  testId: string;
  testName: string;
  prompt: string;
  modelOutput: string;
  failureReason: string;
  category: string;
}

export interface BenchmarkResult {
  suiteId: string;
  suiteName: string;
  candidateId: string;
  candidateRatio: number;
  score: number;
  maxScore: number;
  passedCount: number;
  totalCount: number;
  latencyMs: number;
  throughputTokPerSec: number;
  failedTestCases: FailedTestCase[];
}

export type BenchmarkCategory = 'code' | 'reasoning' | 'json' | 'instruction' | 'arithmetic' | 'classification' | 'summarization';

export interface BenchmarkDefinition {
  id: string;
  category: BenchmarkCategory;
  name: string;
  prompt: string;
  criteria: string;
  scoringMethod: 'exact-normalized' | 'required-fragments' | 'exact-json-object';
  expectedAnswer?: string | Record<string, string | number | boolean>;
  fragments?: string[];
}

export interface BenchmarkRunRequest {
  modelIds: string[];
  benchmarkIds: string[];
  settings?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    timeoutSeconds?: number;
  };
}

export interface BenchmarkRunResult {
  resultId: string;
  runId: string;
  modelId: string;
  benchmarkId: string;
  category: BenchmarkCategory;
  status: 'success' | 'failed' | 'timeout';
  startedAt: string;
  completedAt: string;
  output: string;
  inputTokens: number | null;
  outputTokens: number | null;
  wallClockLatencyMs: number | null;
  ollamaTotalMs: number | null;
  generationMs: number | null;
  tokPerSec: number | null;
  evaluationStatus: 'evaluated' | 'not_evaluated';
  passed: boolean | null;
  score: number | null;
  maxScore: number;
  scoringMethod: BenchmarkDefinition['scoringMethod'];
  error: string | null;
}

export interface BenchmarkRun {
  runId: string;
  status: 'running' | 'completed' | 'failed';
  modelIds: string[];
  benchmarkIds: string[];
  settings: Required<NonNullable<BenchmarkRunRequest['settings']>>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  progress: {
    completed: number;
    total: number;
    currentModelId: string | null;
    currentBenchmarkId: string | null;
  };
  results: BenchmarkRunResult[];
  error: string | null;
}

export type BlendPilotPreference = 'correctness' | 'latency';

export interface BlendPilotRequest {
  runId: string;
  category: BenchmarkCategory;
  comparisonModelId: string;
  preference: BlendPilotPreference;
  minimumEvaluations: number;
}

export interface BlendPilotModelEvidence {
  modelId: string;
  evaluatedCount: number;
  passedCount: number;
  passRatePercent: number | null;
  inferenceFailedCount: number;
  unavailableEvaluationCount: number;
  medianWallLatencyMs: number | null;
  latencySampleCount: number;
  benchmarkIds: string[];
}

export interface BlendPilotRecommendationResult {
  status: 'recommended' | 'insufficient_evidence';
  runId: string | null;
  category: string;
  comparisonModelId: string;
  preference: BlendPilotPreference;
  minimumEvaluations: number;
  recommendedModelId: string | null;
  comparisonModel: BlendPilotModelEvidence | null;
  recommendedModel: BlendPilotModelEvidence | null;
  candidates: BlendPilotModelEvidence[];
  reason: string;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  runId: string;
  modelIds: string[];
  benchmarkIds: string[];
  settings: Required<NonNullable<BenchmarkRunRequest['settings']>>;
  runStatus?: BenchmarkRun['status'] | 'missing';
}

export interface ExperimentComparisonSummary {
  experimentId: string;
  runId: string;
  status: BenchmarkRun['status'];
  models: Array<{
    modelId: string;
    evaluatedCases: number;
    passRate: number | null;
    failedInferences: number;
    unavailableEvaluations: number;
    medianWallLatencyMs: number | null;
  }>;
}

export interface ExperimentComparison {
  configurations: { comparable: boolean; sameBenchmarks: boolean; sameSettings: boolean };
  results: [ExperimentComparisonSummary, ExperimentComparisonSummary];
}

export interface SettingsState {
  backendMode: 'mock' | 'ollama';
  fastApiUrl: string;
  connectionStatus: 'connected_mock' | 'connected_api' | 'disconnected' | 'connecting';
  defaultTemperature: number;
  defaultTopP: number;
  defaultMaxTokens: number;
  defaultBenchmarkSamples: number;
  requestTimeoutSeconds: number;
  enableSafetyChecks: boolean;
  autoSaveExperiments: boolean;
  quantizationDefault: string;
}

export interface GraphifyContext {
  text: string;
  sources: { symbol: string; file: string; line: number; snippet: string; changedSinceIndex: boolean }[];
  indexedAt: string;
  retrievalMs: number;
  truncated: boolean;
}
