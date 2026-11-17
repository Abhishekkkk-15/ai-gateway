import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('Stateless Responses API (/v1/responses)', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-responses';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-resp-1',
      name: 'Test Responses Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });

    app.routingCache.setModelForTesting('mock/gpt-4o', {
      model: {
        id: 'gpt-4o',
        providerId: 'mock-provider',
        slug: 'mock/gpt-4o',
        displayName: 'GPT-4o Mock',
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

    app.routingCache.setAliasForTesting('gpt-4o', 'mock/gpt-4o');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/responses',
      payload: {
        model: 'gpt-4o',
        input: 'Hello',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error?.code).toBe('invalid_api_key');
  });

  it('rejects missing model or input with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/responses',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'gpt-4o',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error?.type).toBe('invalid_request_error');
  });

  it('rejects previous_response_id in stateless mode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/responses',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'gpt-4o',
        input: 'Hello',
        previous_response_id: 'resp_abc123',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error?.code).toBe('stateless_unsupported');
  });

  it('rejects conversation in stateless mode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/responses',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'gpt-4o',
        input: 'Hello',
        conversation: 'conv_abc123',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error?.code).toBe('stateless_unsupported');
  });

  it('generates non-streamed response with synthesized output_text and OpenAI envelope', async () => {
    const originalFetch = globalThis.fetch;
    const mockChatCompletion = {
      id: 'chatcmpl-resp-123',
      object: 'chat.completion',
      created: 1710000000,
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! I am ready to help you build great software.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 12,
        total_tokens: 22,
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockChatCompletion), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/responses',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'gpt-4o',
        input: 'Say hello!',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toMatch(/^resp_[a-zA-Z0-9_-]+$/);
    expect(body.object).toBe('response');
    expect(body.status).toBe('completed');
    expect(body.output_text).toBe('Hello! I am ready to help you build great software.');
    expect(body.output).toHaveLength(1);
    expect(body.output[0].role).toBe('assistant');
    expect(body.output[0].content[0].type).toBe('output_text');
    expect(body.output[0].content[0].text).toBe('Hello! I am ready to help you build great software.');
    expect(body.usage.total_tokens).toBe(22);

    // Retrieve must fail — nothing was stored
    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/responses/${body.id}`,
      headers: { Authorization: `Bearer ${validKey}` },
    });
    expect(getRes.statusCode).toBe(400);
    expect(JSON.parse(getRes.body).error?.code).toBe('stateless_unsupported');

    globalThis.fetch = originalFetch;
  });

  it('supports SSE streaming for /v1/responses', async () => {
    const originalFetch = globalThis.fetch;

    const sseChunks = [
      'data: {"id":"chatcmpl-stream","object":"chat.completion.chunk","created":1710000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":"Streaming "},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-stream","object":"chat.completion.chunk","created":1710000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"response!"},"finish_reason":"stop"}]}\n\n',
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

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/responses',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'gpt-4o',
        input: 'Stream test',
        stream: true,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.body).toContain('response.created');
    expect(res.body).toContain('response.output_text.delta');
    expect(res.body).toContain('Streaming');
    expect(res.body).toContain('response.completed');

    globalThis.fetch = originalFetch;
  });

  it('rejects conversations API in stateless mode', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/conversations',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        metadata: { user_tag: 'test-user' },
      },
    });

    expect(createRes.statusCode).toBe(400);
    const body = JSON.parse(createRes.body);
    expect(body.error?.code).toBe('stateless_unsupported');
  });

  it('forwards inline input_image as chat image_url parts', async () => {
    const originalFetch = globalThis.fetch;
    let capturedBody: { messages?: unknown[] } | null = null;

    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body ?? '{}'));
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-vision',
          object: 'chat.completion',
          choices: [{ message: { role: 'assistant', content: 'A cat.' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/responses',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'gpt-4o',
        input: [
          { type: 'input_text', text: 'What is this?' },
          { type: 'input_image', image_url: 'data:image/png;base64,abc' },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(capturedBody?.messages).toEqual([
      { role: 'user', content: 'What is this?' },
      {
        role: 'user',
        content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }],
      },
    ]);

    globalThis.fetch = originalFetch;
  });

  it('rejects file_id in responses input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/responses',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'gpt-4o',
        input: [{ type: 'input_file', file_id: 'file-abc' }],
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error?.message).toMatch(/file_id/);
  });
});
