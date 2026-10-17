import { ModelInfo } from '../types';

interface OllamaTag {
  name: string;
  remote_model?: string;
  remote_host?: string;
  details?: { family?: string; parameter_size?: string; format?: string; quantization_level?: string };
}
export function describeOllamaModel(model: OllamaTag): ModelInfo {
  const cloud = Boolean(model.remote_host || model.remote_model || /(?:^|[:\-])cloud$/.test(model.name));
  return {
    id: model.name, name: model.name, executionMode: cloud ? 'cloud' : 'local',
    family: model.details?.family || (model.name.startsWith('gemma4:') ? 'Gemma 4' : 'Unknown'),
    parameterCount: model.details?.parameter_size || 'Unknown', contextWindow: 0,
    architecture: cloud ? 'Ollama Cloud' : model.details?.format || 'Ollama', baseSpecialization: 'general',
    defaultQuantization: model.details?.quantization_level || 'Unknown',
    tags: cloud ? ['Cloud hosted', 'Internet and Ollama sign-in required'] : ['Local inference'],
    description: cloud ? 'Runs on Ollama Cloud. Prompts and enabled Graphify excerpts are sent to Ollama servers.' : 'Installed local Ollama model. Context limit is model dependent.',
  };
}

export function selectComparisonModels(models: ModelInfo[], previousA?: string, previousB?: string) {
  const modelA = models.find(m => m.id === previousA) || models.find(m => m.executionMode !== 'cloud') || models[0];
  const previous = models.find(m => m.id === previousB && m.id !== modelA?.id);
  const modelB = previous || models.find(m => m.id !== modelA?.id && m.executionMode === 'cloud') || models.find(m => m.id !== modelA?.id) || modelA;
  return { modelA, modelB };
}
