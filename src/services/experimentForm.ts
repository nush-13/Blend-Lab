import { Experiment } from '../types';

export interface ExperimentFormConfiguration {
  name: string;
  description: string;
  modelIds: string[];
  benchmarkIds: string[];
  settings: Experiment['settings'];
}

export function configurationForRerun(experiment: Experiment): ExperimentFormConfiguration {
  return {
    name: `${experiment.name} rerun`, description: experiment.description,
    modelIds: [...experiment.modelIds], benchmarkIds: [...experiment.benchmarkIds],
    settings: { ...experiment.settings },
  };
}

export function initialExperimentModels(availableModelIds: string[]): string[] {
  return availableModelIds.slice(0, 2);
}

export function toggleSelectedId(items: string[], id: string): string[] {
  return items.includes(id) ? items.filter(item => item !== id) : [...items, id];
}

export function formatRecordedMetric(value: number | null, suffix = ''): string {
  return value === null || !Number.isFinite(value) ? 'Unavailable' : `${value}${suffix}`;
}
