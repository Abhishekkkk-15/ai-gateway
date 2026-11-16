import { describe, it, expect, vi, afterEach } from 'vitest';
import { GroqAdapter } from '../src/index.js';
import type { ProviderConfig } from '@ai-gateway/core';

describe('GroqAdapter', () => {
  const adapter = new GroqAdapter();
  const config: ProviderConfig = {
    id: 'groq',
    name: 'Groq',
    adapterType: 'groq',
    apiKey: 'gsk-test-key',
    isEnabled: true,
  };

  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('has correct metadata and capabilities', () => {
    expect(adapter.id).toBe('groq');
    expect(adapter.defaultBaseUrl).toBe('https://api.groq.com/openai/v1');
    expect(adapter.supportedCapabilities).toContain('chat');
    expect(adapter.supportedCapabilities).toContain('stt');
  });

  it('fetches live models from Groq /models', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        object: 'list',
        data: [
          { id: 'llama-3.3-70b-versatile', object: 'model', context_window: 131072 },
          { id: 'whisper-large-v3', object: 'model' },
        ],
      }),
    } as unknown as Response);

    const models = await adapter.listModels(config);
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe('llama-3.3-70b-versatile');
    expect(models[0].capabilities).toContain('chat');
    expect(models[1].capabilities).toContain('stt');
  });

  it('forwards chat completions to Groq', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    const response = await adapter.chatCompletions!(
      { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'Hi' }] },
      config
    );
    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.groq.com/openai/v1/chat/completions', expect.any(Object));
    expect(response.status).toBe(200);
  });

  it('forwards transcribeAudio to Groq /audio/transcriptions', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'Hello' }), { status: 200 }));
    const formData = new FormData();
    const response = await adapter.transcribeAudio!(formData, config);
    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.groq.com/openai/v1/audio/transcriptions', expect.any(Object));
    expect(response.status).toBe(200);
  });
});
