import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('Moderations API (/v1/moderations)', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-moderations';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    // Seed mock gateway key
    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-1',
      name: 'Test Moderations Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });

    // Seed mock moderation model
    app.routingCache.setModelForTesting('mock/omni-moderation-latest', {
      model: {
        id: 'omni-moderation-latest',
        providerId: 'mock-provider',
        slug: 'mock/omni-moderation-latest',
        displayName: 'Omni Moderation Latest',
        capabilities: ['tools'],
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

    app.routingCache.setAliasForTesting('omni-moderation-latest', 'mock/omni-moderation-latest');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated request with 401 OpenAI error envelope', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/moderations',
      payload: {
        input: 'Testing moderation filter without key',
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
      url: '/v1/moderations',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('proxies moderation request with single text input and returns standard OpenAI results', async () => {
    const originalFetch = globalThis.fetch;
    const mockModerationResponse = {
      id: 'modr-abcdef123456',
      model: 'omni-moderation-latest',
      results: [
        {
          flagged: false,
          categories: {
            sexual: false,
            hate: false,
            harassment: false,
            'self-harm': false,
            'sexual/minors': false,
            'hate/threatening': false,
            'violence/graphic': false,
            'self-harm/intent': false,
            'self-harm/instructions': false,
            'harassment/threatening': false,
            violence: false,
            illicit: false,
            'illicit/violent': false,
          },
          category_scores: {
            sexual: 0.0001,
            hate: 0.0002,
            harassment: 0.0001,
            'self-harm': 0.00005,
            'sexual/minors': 0.00001,
            'hate/threatening': 0.00005,
            'violence/graphic': 0.0001,
            'self-harm/intent': 0.00002,
            'self-harm/instructions': 0.00001,
            'harassment/threatening': 0.00005,
            violence: 0.0003,
            illicit: 0.00005,
            'illicit/violent': 0.00002,
          },
          category_applied_input_types: {
            sexual: ['text'],
            hate: ['text'],
            harassment: ['text'],
            'self-harm': ['text'],
            'sexual/minors': ['text'],
            'hate/threatening': ['text'],
            'violence/graphic': ['text'],
            'self-harm/intent': ['text'],
            'self-harm/instructions': ['text'],
            'harassment/threatening': ['text'],
            violence: ['text'],
            illicit: ['text'],
            'illicit/violent': ['text'],
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockModerationResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/moderations',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        input: 'I love open-source software and fast AI gateways!',
        model: 'omni-moderation-latest',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe('modr-abcdef123456');
    expect(body.model).toBe('omni-moderation-latest');
    expect(body.results).toHaveLength(1);
    expect(body.results[0].flagged).toBe(false);
    expect(body.results[0].categories.hate).toBe(false);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.mock.com/v1/moderations',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          input: 'I love open-source software and fast AI gateways!',
          model: 'omni-moderation-latest',
        }),
      })
    );

    globalThis.fetch = originalFetch;
  });

  it('correctly handles flagged content and array inputs', async () => {
    const originalFetch = globalThis.fetch;
    const mockFlaggedResponse = {
      id: 'modr-flagged-789',
      model: 'omni-moderation-latest',
      results: [
        {
          flagged: true,
          categories: {
            sexual: false,
            hate: true,
            harassment: true,
            'self-harm': false,
            'sexual/minors': false,
            'hate/threatening': true,
            'violence/graphic': false,
            'self-harm/intent': false,
            'self-harm/instructions': false,
            'harassment/threatening': true,
            violence: false,
            illicit: false,
            'illicit/violent': false,
          },
          category_scores: {
            sexual: 0.001,
            hate: 0.985,
            harassment: 0.952,
            'self-harm': 0.001,
            'sexual/minors': 0.0001,
            'hate/threatening': 0.923,
            'violence/graphic': 0.002,
            'self-harm/intent': 0.0001,
            'self-harm/instructions': 0.0001,
            'harassment/threatening': 0.895,
            violence: 0.05,
            illicit: 0.001,
            'illicit/violent': 0.001,
          },
          category_applied_input_types: {
            hate: ['text'],
            harassment: ['text'],
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockFlaggedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/moderations',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        input: ['Violent hate speech sample for moderation test'],
        model: 'mock/omni-moderation-latest',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.results[0].flagged).toBe(true);
    expect(body.results[0].categories.hate).toBe(true);
    expect(body.results[0].category_scores.hate).toBeGreaterThan(0.9);

    globalThis.fetch = originalFetch;
  });
});
