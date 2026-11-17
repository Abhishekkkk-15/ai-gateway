import { describe, it, expect } from 'vitest';
import { OPENAI_COMPATIBLE_PRESETS, getOpenAICompatiblePreset } from '../src/presets.js';

describe('OpenAI-compatible presets', () => {
  it('includes groq and nvidia with openai-compatible adapterType', () => {
    const groq = getOpenAICompatiblePreset('groq');
    const nvidia = getOpenAICompatiblePreset('nvidia');

    expect(groq).toBeDefined();
    expect(groq?.adapterType).toBe('openai-compatible');
    expect(groq?.defaultBaseUrl).toBe('https://api.groq.com/openai/v1');

    expect(nvidia).toBeDefined();
    expect(nvidia?.adapterType).toBe('openai-compatible');
    expect(nvidia?.defaultBaseUrl).toBe('https://integrate.api.nvidia.com/v1');
  });

  it('lists all presets with unique ids', () => {
    const ids = OPENAI_COMPATIBLE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('openai');
    expect(ids).toContain('deepseek');
    expect(ids).toContain('openrouter');
    expect(ids).toContain('xai');
    expect(ids).toContain('mistral');
    expect(ids).toContain('cloudflare');
  });

  it('includes cloudflare Workers AI with account-scoped OpenAI-compatible base URL', () => {
    const cloudflare = getOpenAICompatiblePreset('cloudflare');

    expect(cloudflare).toEqual(
      expect.objectContaining({
        id: 'cloudflare',
        name: 'Cloudflare Workers AI',
        adapterType: 'openai-compatible',
        defaultBaseUrl:
          'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1',
      })
    );
    expect(cloudflare?.supportedCapabilities).toEqual(
      expect.arrayContaining(['chat', 'embeddings'])
    );
  });

  it('includes openrouter, xai, and mistral with OpenAI-compatible base URLs', () => {
    const openrouter = getOpenAICompatiblePreset('openrouter');
    const xai = getOpenAICompatiblePreset('xai');
    const mistral = getOpenAICompatiblePreset('mistral');

    expect(openrouter).toEqual(
      expect.objectContaining({
        id: 'openrouter',
        name: 'OpenRouter',
        adapterType: 'openai-compatible',
        defaultBaseUrl: 'https://openrouter.ai/api/v1',
      })
    );
    expect(xai).toEqual(
      expect.objectContaining({
        id: 'xai',
        name: 'xAI',
        adapterType: 'openai-compatible',
        defaultBaseUrl: 'https://api.x.ai/v1',
      })
    );
    expect(mistral).toEqual(
      expect.objectContaining({
        id: 'mistral',
        name: 'Mistral',
        adapterType: 'openai-compatible',
        defaultBaseUrl: 'https://api.mistral.ai/v1',
      })
    );
  });
});
