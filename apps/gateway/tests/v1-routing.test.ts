import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('/v1 Routes', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-12345';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    // Seed mock key and model into in-memory cache directly for unit testing
    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-1',
      name: 'Test Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });

    app.routingCache.setModelForTesting('mock/test-chat', {
      model: {
        id: 'test-chat',
        providerId: 'mock-provider',
        slug: 'mock/test-chat',
        displayName: 'Test Chat Model',
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

    app.routingCache.setAliasForTesting('fast-chat', 'mock/test-chat');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated request to /v1/models with 401 OpenAI error envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/models',
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('invalid_api_key');
  });

  it('rejects invalid Bearer token with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/models',
      headers: { Authorization: 'Bearer sk-gw-invalid-key' },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('invalid_api_key');
  });

  it('returns model list on /v1/models with valid Gateway Key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/models',
      headers: { Authorization: `Bearer ${validKey}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.object).toBe('list');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.some((m: { id: string }) => m.id === 'mock/test-chat')).toBe(true);
  });

  it('rejects unknown model with 404 OpenAI error envelope', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'unknown/model-xyz',
        messages: [{ role: 'user', content: 'hello' }],
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('model_not_found');
  });

  it('routes chat completion by slug or alias to upstream provider', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'chatcmpl-test', choices: [{ message: { content: 'Echo' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Call using alias 'fast-chat'
    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'fast-chat',
        messages: [{ role: 'user', content: 'hello' }],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe('chatcmpl-test');

    globalThis.fetch = originalFetch;
  });
});
