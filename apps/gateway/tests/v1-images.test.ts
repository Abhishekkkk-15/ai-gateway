import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('Images API (/v1/images)', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-images';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    // Seed mock gateway key
    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-1',
      name: 'Test Images Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });

    // Seed mock image generation model
    app.routingCache.setModelForTesting('mock/dall-e-3', {
      model: {
        id: 'dall-e-3',
        providerId: 'mock-provider',
        slug: 'mock/dall-e-3',
        displayName: 'DALL-E 3',
        capabilities: ['vision'],
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

    app.routingCache.setAliasForTesting('image-gen', 'mock/dall-e-3');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/images/generations', () => {
    it('rejects unauthenticated request with 401 OpenAI error envelope', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/images/generations',
        payload: {
          prompt: 'A neon cyberpunk city in the rain',
          model: 'image-gen',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('invalid_api_key');
    });

    it('rejects missing prompt with 400 invalid_request_error', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/images/generations',
        headers: { Authorization: `Bearer ${validKey}` },
        payload: {
          model: 'image-gen',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBeDefined();
      expect(body.error.type).toBe('invalid_request_error');
    });

    it('proxies generation request and returns OpenAI image format with url', async () => {
      const originalFetch = globalThis.fetch;
      const mockImageResponse = {
        created: 1710000000,
        data: [
          {
            url: 'https://images.example.com/generated-image-123.png',
            revised_prompt: 'A futuristic cyberpunk metropolis glowing under rain.',
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockImageResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/images/generations',
        headers: { Authorization: `Bearer ${validKey}` },
        payload: {
          model: 'image-gen',
          prompt: 'A neon cyberpunk city in the rain',
          size: '1024x1024',
          quality: 'hd',
          style: 'vivid',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.created).toBe(1710000000);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].url).toBe('https://images.example.com/generated-image-123.png');
      expect(body.data[0].revised_prompt).toContain('cyberpunk');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.mock.com/v1/images/generations',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: 'A neon cyberpunk city in the rain',
            size: '1024x1024',
            quality: 'hd',
            style: 'vivid',
          }),
        })
      );

      globalThis.fetch = originalFetch;
    });

    it('supports b64_json response_format', async () => {
      const originalFetch = globalThis.fetch;
      const mockB64Response = {
        created: 1710000001,
        data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }],
      };

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockB64Response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/images/generations',
        headers: { Authorization: `Bearer ${validKey}` },
        payload: {
          model: 'mock/dall-e-3',
          prompt: 'A minimal dot',
          response_format: 'b64_json',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data[0].b64_json).toBeDefined();

      globalThis.fetch = originalFetch;
    });
  });

  describe('POST /v1/images/edits and variations', () => {
    function createMultipartImagePayload(boundary: string, isVariation = false) {
      const parts = [
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\ndall-e-3\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="input.png"\r\nContent-Type: image/png\r\n\r\nfake-png-bytes\r\n`),
      ];
      if (!isVariation) {
        parts.push(
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\nAdd a red bird\r\n`)
        );
      }
      parts.push(Buffer.from(`--${boundary}--\r\n`));
      return Buffer.concat(parts);
    }

    it('proxies image edits request with multipart payload', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ created: 1710000002, data: [{ url: 'https://images.example.com/edited.png' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const boundary = '----WebKitFormBoundaryImageEdit123';
      const payload = createMultipartImagePayload(boundary);

      const res = await app.inject({
        method: 'POST',
        url: '/v1/images/edits',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          Authorization: `Bearer ${validKey}`,
        },
        payload,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data[0].url).toBe('https://images.example.com/edited.png');

      globalThis.fetch = originalFetch;
    });

    it('proxies image variations request with multipart payload', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ created: 1710000003, data: [{ url: 'https://images.example.com/variation.png' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const boundary = '----WebKitFormBoundaryImageVar456';
      const payload = createMultipartImagePayload(boundary, true);

      const res = await app.inject({
        method: 'POST',
        url: '/v1/images/variations',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          Authorization: `Bearer ${validKey}`,
        },
        payload,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data[0].url).toBe('https://images.example.com/variation.png');

      globalThis.fetch = originalFetch;
    });
  });
});
