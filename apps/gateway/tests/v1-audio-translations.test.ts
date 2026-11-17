import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('POST /v1/audio/translations', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-translations';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    // Seed mock gateway key
    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-1',
      name: 'Test Translations Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });

    // Seed mock whisper model
    app.routingCache.setModelForTesting('groq/whisper-large-v3-turbo', {
      model: {
        id: 'whisper-large-v3-turbo',
        providerId: 'groq',
        slug: 'groq/whisper-large-v3-turbo',
        displayName: 'Whisper Large v3 Turbo',
        capabilities: ['stt'],
        isEnabled: true,
      },
      provider: {
        id: 'groq',
        name: 'Groq',
        adapterType: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: 'groq-key',
        isEnabled: true,
      },
      adapter: app.providerRegistry.get('groq') || app.providerRegistry.getGenericAdapter(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function createMultipartPayload(boundary: string) {
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3-turbo\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="french.mp3"\r\nContent-Type: audio/mpeg\r\n\r\nfake-french-audio\r\n`),
      Buffer.from(`--${boundary}--\r\n`),
    ]);
    return payload;
  }

  it('rejects unauthenticated request with 401 OpenAI error envelope', async () => {
    const boundary = '----WebKitFormBoundaryTranslations123';
    const payload = createMultipartPayload(boundary);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/audio/translations',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('invalid_api_key');
  });

  it('proxies audio translation request and returns translated English text', async () => {
    const originalFetch = globalThis.fetch;
    const mockTranslationResponse = {
      text: 'Hello, this is a translated English message from French.',
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTranslationResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const boundary = '----WebKitFormBoundaryTranslations456';
    const payload = createMultipartPayload(boundary);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/audio/translations',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${validKey}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-gateway-feature']).toBe('experimental');
    const body = JSON.parse(res.body);
    expect(body.text).toBe('Hello, this is a translated English message from French.');

    globalThis.fetch = originalFetch;
  });
});
