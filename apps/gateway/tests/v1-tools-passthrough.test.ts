import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get weather',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
    },
  },
];

const responseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'answer',
    schema: {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
    },
  },
};

describe('tools / response_format pass-through', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-tools';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-tools-1',
      name: 'Test Tools Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });

    app.routingCache.setModelForTesting('mock/tools-chat', {
      model: {
        id: 'tools-chat',
        providerId: 'mock-provider',
        slug: 'mock/tools-chat',
        displayName: 'Tools Chat Model',
        capabilities: ['chat', 'tools'],
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

  it('forwards tools, tool_choice, and response_format on chat completions', async () => {
    const originalFetch = globalThis.fetch;
    let upstreamBody: Record<string, unknown> | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts: { body?: string }) => {
      upstreamBody = opts?.body ? JSON.parse(opts.body) : undefined;
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-tools',
          choices: [{ message: { role: 'assistant', content: '{"ok":true}' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'mock/tools-chat',
        messages: [{ role: 'user', content: 'weather?' }],
        tools,
        tool_choice: 'auto',
        response_format: responseFormat,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(upstreamBody?.tools).toEqual(tools);
    expect(upstreamBody?.tool_choice).toBe('auto');
    expect(upstreamBody?.response_format).toEqual(responseFormat);

    globalThis.fetch = originalFetch;
  });

  it('forwards tools, tool_choice, and response_format on responses', async () => {
    const originalFetch = globalThis.fetch;
    let upstreamBody: Record<string, unknown> | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts: { body?: string }) => {
      upstreamBody = opts?.body ? JSON.parse(opts.body) : undefined;
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-tools-resp',
          choices: [{ message: { role: 'assistant', content: '{"ok":true}' } }],
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
        model: 'mock/tools-chat',
        input: 'weather?',
        tools,
        tool_choice: { type: 'function', function: { name: 'get_weather' } },
        response_format: responseFormat,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(upstreamBody?.tools).toEqual(tools);
    expect(upstreamBody?.tool_choice).toEqual({
      type: 'function',
      function: { name: 'get_weather' },
    });
    expect(upstreamBody?.response_format).toEqual(responseFormat);

    globalThis.fetch = originalFetch;
  });
});
