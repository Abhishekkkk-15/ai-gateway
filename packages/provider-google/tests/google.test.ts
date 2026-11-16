import { describe, it, expect, vi, afterEach } from 'vitest';
import { GoogleAdapter } from '../src/index.js';
import type { ProviderConfig } from '@ai-gateway/core';

describe('GoogleAdapter', () => {
  const adapter = new GoogleAdapter();
  const config: ProviderConfig = {
    id: 'google',
    name: 'Google AI Studio',
    adapterType: 'google',
    apiKey: 'AIzaSy-test-key',
    isEnabled: true,
  };

  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('has correct metadata and capabilities', () => {
    expect(adapter.id).toBe('google');
    expect(adapter.defaultBaseUrl).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
    expect(adapter.supportedCapabilities).toContain('chat');
  });

  it('normalizes Google model IDs by stripping models/ prefix', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    } as unknown as Response);

    const models = await adapter.listModels(config);
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe('gemini-2.5-flash');
    expect(models[1].id).toBe('gemini-2.5-pro');
  });

  it('forwards chat completions via Google OpenAI-compatible endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    const response = await adapter.chatCompletions!(
      { model: 'gemini-2.5-flash', messages: [{ role: 'user', content: 'Hi' }] },
      config
    );
    expect(globalThis.fetch).toHaveBeenCalledWith('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', expect.any(Object));
    expect(response.status).toBe(200);
  });
});
