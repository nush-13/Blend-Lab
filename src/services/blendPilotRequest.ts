import { BlendPilotPreference } from '../types';

export function blendPilotRequestKey(input: {
  runId: string;
  category: string;
  comparisonModelId: string;
  preference: BlendPilotPreference;
  minimumEvaluations: number;
  minimumPassRatePercent?: number;
}): string {
  return JSON.stringify([input.runId, input.category, input.comparisonModelId, input.preference, input.minimumEvaluations, input.minimumPassRatePercent ?? 0]);
}
