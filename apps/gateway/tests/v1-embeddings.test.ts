import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('POST /v1/embeddings', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-embeddings';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    // Seed mock gateway key
    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-1',
      name: 'Test Embeddings Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });

    // Seed mock embedding model
    app.routingCache.setModelForTesting('mock/text-embedding-3-small', {
      model: {
        id: 'text-embedding-3-small',
        providerId: 'mock-provider',
        slug: 'mock/text-embedding-3-small',
        displayName: 'Mock Embedding Model',
        capabilities: ['embeddings'],
        isEnabled: true,
      },
      provider: {
        id: 'mock-provider',
        name: 'Mock Provider',
        adapterType: 'openai-compatible',
        baseUrl: 'https://api.mock.com/v1',
        apiKey: 'mock-key',
        isEnabled: true,
      },
      adapter: app.providerRegistry.getGenericAdapter(),
    });

    app.routingCache.setAliasForTesting('fast-embedding', 'mock/text-embedding-3-small');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated request with 401 OpenAI error envelope', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/embeddings',
      payload: {
        model: 'fast-embedding',
        input: 'Hello world',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('invalid_api_key');
  });

  it('rejects missing or empty input with 400 invalid_request_error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/embeddings',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'fast-embedding',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('rejects model without embeddings capability with 400 error', async () => {
    app.routingCache.setModelForTesting('mock/chat-only', {
      model: {
        id: 'chat-only',
        providerId: 'mock-provider',
        slug: 'mock/chat-only',
        displayName: 'Chat Only Model',
        capabilities: ['chat'],
        isEnabled: true,
      },
      provider: {
        id: 'mock-provider',
        name: 'Mock Provider',
        adapterType: 'openai-compatible',
        baseUrl: 'https://api.mock.com/v1',
        apiKey: 'mock-key',
        isEnabled: true,
      },
      adapter: app.providerRegistry.getGenericAdapter(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/embeddings',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'mock/chat-only',
        input: 'test text',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
    expect(body.error.message).toContain('embeddings');
  });

  it('proxies valid single string embedding request and returns OpenAI list format', async () => {
    const originalFetch = globalThis.fetch;
    const mockEmbeddingsResponse = {
      object: 'list',
      data: [
        {
          object: 'embedding',
          embedding: [0.0123, -0.0456, 0.0789],
          index: 0,
        },
      ],
      model: 'text-embedding-3-small',
      usage: {
        prompt_tokens: 3,
        total_tokens: 3,
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockEmbeddingsResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/embeddings',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'fast-embedding',
        input: 'Represent this sentence for retrieval',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.object).toBe('list');
    expect(body.data).toHaveLength(1);
    expect(body.data[0].object).toBe('embedding');
    expect(body.data[0].index).toBe(0);
    expect(body.data[0].embedding).toEqual([0.0123, -0.0456, 0.0789]);
    expect(body.usage.prompt_tokens).toBe(3);

    // Verify upstream fetch payload forwarded model and input
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.mock.com/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: 'Represent this sentence for retrieval',
        }),
      })
    );

    globalThis.fetch = originalFetch;
  });

  it('proxies batch array input with dimensions and base64 encoding_format', async () => {
    const originalFetch = globalThis.fetch;
    const mockBatchResponse = {
      object: 'list',
      data: [
        { object: 'embedding', embedding: 'base64str1', index: 0 },
        { object: 'embedding', embedding: 'base64str2', index: 1 },
      ],
      model: 'text-embedding-3-small',
      usage: { prompt_tokens: 10, total_tokens: 10 },
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockBatchResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/embeddings',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'mock/text-embedding-3-small',
        input: ['First chunk', 'Second chunk'],
        dimensions: 512,
        encoding_format: 'base64',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.data[1].embedding).toBe('base64str2');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.mock.com/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: ['First chunk', 'Second chunk'],
          dimensions: 512,
          encoding_format: 'base64',
        }),
      })
    );

    globalThis.fetch = originalFetch;
  });
});
