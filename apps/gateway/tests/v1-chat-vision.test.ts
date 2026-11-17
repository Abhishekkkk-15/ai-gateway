import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('Chat vision pass-through (/v1/chat/completions)', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-vision';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-vision-1',
      name: 'Test Vision Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });

    app.routingCache.setModelForTesting('mock/vision-chat', {
      model: {
        id: 'vision-chat',
        providerId: 'mock-provider',
        slug: 'mock/vision-chat',
        displayName: 'Vision Chat Model',
        capabilities: ['chat', 'vision'],
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
  });

  afterAll(async () => {
    await app.close();
  });

  async function captureUpstream(messages: unknown[]) {
    const originalFetch = globalThis.fetch;
    let upstreamBody: { messages?: unknown[] } | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts: { body?: string }) => {
      upstreamBody = opts?.body ? JSON.parse(opts.body) : undefined;
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-vision',
          choices: [{ message: { role: 'assistant', content: 'ok' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'mock/vision-chat',
        messages,
      },
    });

    globalThis.fetch = originalFetch;
    return { res, upstreamBody };
  }

  it('forwards https image_url content parts unchanged', async () => {
    const content = [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image_url', image_url: { url: 'https://example.com/cat.png' } },
    ];
    const { res, upstreamBody } = await captureUpstream([{ role: 'user', content }]);

    expect(res.statusCode).toBe(200);
    expect(upstreamBody?.messages?.[0]).toEqual({ role: 'user', content });
  });

  it('forwards data: base64 image_url content parts unchanged', async () => {
    const content = [
      { type: 'text', text: 'Describe' },
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' },
      },
    ];
    const { res, upstreamBody } = await captureUpstream([{ role: 'user', content }]);

    expect(res.statusCode).toBe(200);
    expect(upstreamBody?.messages?.[0]).toEqual({ role: 'user', content });
  });
});
