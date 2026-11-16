import { describe, it, expect, vi, afterEach } from 'vitest';
import { NvidiaAdapter } from '../src/index.js';
import type { ProviderConfig } from '@ai-gateway/core';

describe('NvidiaAdapter', () => {
  const adapter = new NvidiaAdapter();
  const config: ProviderConfig = {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    adapterType: 'nvidia',
    apiKey: 'nvapi-test-key',
    isEnabled: true,
  };

  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('has correct metadata and capabilities', () => {
    expect(adapter.id).toBe('nvidia');
    expect(adapter.defaultBaseUrl).toBe('https://integrate.api.nvidia.com/v1');
    expect(adapter.supportedCapabilities).toContain('chat');
  });

  it('fetches live models from NVIDIA NIM /models', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ id: 'meta/llama-3.1-405b-instruct' }],
      }),
    } as unknown as Response);

    const models = await adapter.listModels(config);
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('meta/llama-3.1-405b-instruct');
  });

  it('forwards chat completions to NVIDIA NIM endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    const response = await adapter.chatCompletions!(
      { model: 'meta/llama-3.1-405b-instruct', messages: [{ role: 'user', content: 'Hi' }] },
      config
    );
    expect(globalThis.fetch).toHaveBeenCalledWith('https://integrate.api.nvidia.com/v1/chat/completions', expect.any(Object));
    expect(response.status).toBe(200);
  });
});
