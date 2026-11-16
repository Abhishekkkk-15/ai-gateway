import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GenericOpenAIAdapter } from '../src/adapters/generic-openai.js';
import type { ProviderConfig, OpenAIChatCompletionRequest } from '../src/types.js';

describe('GenericOpenAIAdapter', () => {
  const adapter = new GenericOpenAIAdapter();
  const config: ProviderConfig = {
    id: 'custom-deepseek',
    name: 'DeepSeek',
    adapterType: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: 'sk-test-key',
    isEnabled: true,
  };

  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('lists models by querying upstream /models and mapping response', async () => {
    const mockModelsResponse = {
      object: 'list',
      data: [
        { id: 'deepseek-chat', object: 'model', owned_by: 'deepseek' },
        { id: 'deepseek-reasoner', object: 'model', owned_by: 'deepseek' },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockModelsResponse,
    } as unknown as Response);

    const models = await adapter.listModels(config);

    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.deepseek.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer sk-test-key',
        'Content-Type': 'application/json',
      },
      signal: undefined,
    });

    expect(models).toHaveLength(2);
    expect(models[0]).toEqual({
      id: 'deepseek-chat',
      providerId: 'custom-deepseek',
      displayName: 'deepseek-chat',
      capabilities: ['chat'],
    });
  });

  it('forwards chat completions request to upstream /chat/completions', async () => {
    const chatRequest: OpenAIChatCompletionRequest = {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false,
    };

    const mockResponse = new Response(JSON.stringify({ id: 'chatcmpl-123', choices: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const response = await adapter.chatCompletions!(chatRequest, config);

    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sk-test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatRequest),
      signal: undefined,
      duplex: 'half',
    });

    expect(response.status).toBe(200);
  });
});
