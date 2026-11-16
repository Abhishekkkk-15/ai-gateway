import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('Provider Lifecycle & Chat Resolution Integration', () => {
  let app: FastifyInstance;
  const testApiKey = 'sk-gw-integration-test-key-999';
  const keyHash = hashGatewayKey(testApiKey);
  let adminCookie: string;

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'supersecretadminpassword123';
    process.env.JWT_SECRET = 'jwt-super-secret-key-at-least-32-chars!!';
    process.env.MASTER_SECRET = 'master-secret-key-at-least-32-chars-long!!';

    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    // Authenticate admin to obtain session cookie
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { username: 'admin', password: 'supersecretadminpassword123' },
    });
    const cookies = loginRes.headers['set-cookie'];
    adminCookie = Array.isArray(cookies) ? cookies[0] : (cookies as string);

    // Register test gateway key in memory
    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-test',
      name: 'Integration Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('routes chat completions using short model name and modelId', async () => {
    // Register active mock model
    app.routingCache.setModelForTesting('nvidia/openai/gpt-oss-20b', {
      model: {
        id: 'openai/gpt-oss-20b',
        providerId: 'nvidia',
        slug: 'nvidia/openai/gpt-oss-20b',
        displayName: 'GPT OSS 20B',
        capabilities: ['chat'],
        isEnabled: true,
      },
      provider: {
        id: 'nvidia',
        name: 'NVIDIA NIM',
        adapterType: 'openai-compatible',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        apiKey: 'nvapi-mock',
        isEnabled: true,
      },
      adapter: app.providerRegistry.getGenericAdapter(),
    });

    const originalFetch = globalThis.fetch;
    let capturedBody: string | undefined;

    globalThis.fetch = vi.fn().mockImplementation((_url, opts: { body?: string }) => {
      capturedBody = opts?.body;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'chatcmpl-mock-success',
            choices: [{ message: { role: 'assistant', content: 'Hello from gateway!' } }],
            usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    });

    // 1. Call via full slug
    const resFull = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { Authorization: `Bearer ${testApiKey}` },
      payload: {
        model: 'nvidia/openai/gpt-oss-20b',
        messages: [{ role: 'user', content: 'hello' }],
      },
    });
    expect(resFull.statusCode).toBe(200);
    const jsonFull = JSON.parse(resFull.body);
    expect(jsonFull.id).toBe('chatcmpl-mock-success');

    // Verify upstream received the unwrapped model id "openai/gpt-oss-20b"
    const parsedPayload = JSON.parse(capturedBody!);
    expect(parsedPayload.model).toBe('openai/gpt-oss-20b');

    globalThis.fetch = originalFetch;
  });

  it('returns a clear actionable error envelope when a requested model provider is disabled', async () => {
    // Make sure cache has known model info indicating disabled provider
    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { Authorization: `Bearer ${testApiKey}` },
      payload: {
        model: 'disabled-provider/some-model',
        messages: [{ role: 'user', content: 'hello' }],
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('model_not_found');
    expect(body.error.message).toContain("The model 'disabled-provider/some-model' does not exist or is not enabled");
  });

  it('correctly handles streaming SSE responses with reasoning content', async () => {
    app.routingCache.setModelForTesting('nvidia/nemotron-3.5-lightning-30b-a3b', {
      model: {
        id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
        providerId: 'nvidia',
        slug: 'nvidia/nemotron-3.5-lightning-30b-a3b',
        displayName: 'Nemotron 3.5 Lightning',
        capabilities: ['chat'],
        isEnabled: true,
      },
      provider: {
        id: 'nvidia',
        name: 'NVIDIA NIM',
        adapterType: 'openai-compatible',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        apiKey: 'nvapi-mock',
        isEnabled: true,
      },
      adapter: app.providerRegistry.getGenericAdapter(),
    });

    const sseChunks = [
      'data: {"id":"chatcmpl-1","choices":[{"delta":{"role":"assistant","reasoning_content":"Thinking"}}]}\n\n',
      'data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"Done"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of sseChunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      },
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { Authorization: `Bearer ${testApiKey}` },
      payload: {
        model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
        messages: [{ role: 'user', content: 'test reasoning' }],
        stream: true,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.body).toContain('reasoning_content');
    expect(res.body).toContain('Done');
    expect(res.body).toContain('[DONE]');

    globalThis.fetch = originalFetch;
  });

  it('normalizes upstream 404 (Function not found for account) cleanly into client response', async () => {
    app.routingCache.setModelForTesting('nvidia/google/gemma-3-12b-it', {
      model: {
        id: 'google/gemma-3-12b-it',
        providerId: 'nvidia',
        slug: 'nvidia/google/gemma-3-12b-it',
        displayName: 'Gemma 3 12B IT',
        capabilities: ['chat'],
        isEnabled: true,
      },
      provider: {
        id: 'nvidia',
        name: 'NVIDIA NIM',
        adapterType: 'openai-compatible',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        apiKey: 'nvapi-mock',
        isEnabled: true,
      },
      adapter: app.providerRegistry.getGenericAdapter(),
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 404,
          title: 'Not Found',
          detail: "Function 'ee47df99': Not found for account 'uvETQCoT8kz'",
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { Authorization: `Bearer ${testApiKey}` },
      payload: {
        model: 'nvidia/google/gemma-3-12b-it',
        messages: [{ role: 'user', content: 'hi' }],
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
    expect(body.error.message).toContain('Upstream NVIDIA NIM error');
    expect(body.error.message).toContain('Function');

    globalThis.fetch = originalFetch;
  });
});
