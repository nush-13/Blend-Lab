import { ModelResponse, GraphifyContext, ResponseSelection } from '../types';

export interface PlaygroundResponses {
  selection?: ResponseSelection;
  graphifyContext?: GraphifyContext | null;
  sourceA: ModelResponse;
  candidate: ModelResponse;
  sourceB: ModelResponse;
}

function response(modelName: string, roleName: string, status: ModelResponse['status'], text: string, error: string | null = null): ModelResponse {
  return {
    modelName, roleName, status, provenance: 'none', text, error,
    inputTokens: null, outputTokens: null, tokPerSec: null, latencyMs: null,
    generationMs: null, ollamaTotalMs: null, promptProcessingMs: null, loadMs: null,
    timestamp: '', contextUsed: null,
  };
}

export function createIdleResponses(modelAId: string, modelBId: string): PlaygroundResponses {
  return {
    sourceA: response(modelAId, 'Source Model A', 'idle', 'Run a prompt to generate a response.'),
    candidate: response('Recommended answer', 'Recommended answer', 'idle', 'Run a prompt to generate a response.'),
    sourceB: response(modelBId, 'Source Model B', 'idle', 'Run a prompt to generate a response.'),
  };
}

export function createPendingResponses(modelAId: string, modelBId: string): PlaygroundResponses {
  return {
    sourceA: response(modelAId, 'Source Model A', 'loading', ''),
    candidate: response('Recommended answer', 'Selecting by performance', 'loading', ''),
    sourceB: response(modelBId, 'Source Model B', 'loading', ''),
  };
}

export function createFailedResponses(modelAId: string, modelBId: string, error: string): PlaygroundResponses {
  return {
    sourceA: response(modelAId, 'Source Model A', 'error', '', error),
    candidate: response('Recommended answer', 'Selecting by performance', 'error', '', error),
    sourceB: response(modelBId, 'Source Model B', 'error', '', error),
  };
}