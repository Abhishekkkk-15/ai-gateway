import type { ModelCapability } from './types.js';

/** Catalog of known OpenAI-compatible providers (no dedicated adapter package). */
export interface OpenAICompatiblePreset {
  id: string;
  name: string;
  adapterType: 'openai-compatible';
  defaultBaseUrl: string;
  supportedCapabilities: ModelCapability[];
}

export const OPENAI_COMPATIBLE_PRESETS: OpenAICompatiblePreset[] = [
  {
    id: 'groq',
    name: 'Groq',
    adapterType: 'openai-compatible',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    supportedCapabilities: ['chat', 'stt', 'vision', 'tools'],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    adapterType: 'openai-compatible',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    supportedCapabilities: ['chat', 'embeddings', 'vision', 'tools'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    adapterType: 'openai-compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    supportedCapabilities: ['chat', 'embeddings', 'vision', 'tools'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    adapterType: 'openai-compatible',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    supportedCapabilities: ['chat', 'tools'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    adapterType: 'openai-compatible',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    supportedCapabilities: ['chat', 'embeddings', 'vision', 'tools'],
  },
  {
    id: 'xai',
    name: 'xAI',
    adapterType: 'openai-compatible',
    defaultBaseUrl: 'https://api.x.ai/v1',
    supportedCapabilities: ['chat', 'embeddings', 'vision', 'tools'],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    adapterType: 'openai-compatible',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    supportedCapabilities: ['chat', 'embeddings', 'vision', 'tools'],
  },
];

export function getOpenAICompatiblePreset(id: string): OpenAICompatiblePreset | undefined {
  return OPENAI_COMPATIBLE_PRESETS.find((p) => p.id === id);
}
