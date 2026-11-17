import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('Batches API (/v1/batches) — unsupported', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-batches';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-batches-1',
      name: 'Test Batches Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/batches',
      payload: { input_file_id: 'file-x', endpoint: '/v1/chat/completions' },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error?.code).toBe('invalid_api_key');
  });

  it('returns 501 unsupported_resource when authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/batches',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: { input_file_id: 'file-x', endpoint: '/v1/chat/completions' },
    });

    expect(res.statusCode).toBe(501);
    const body = JSON.parse(res.body);
    expect(body.error?.code).toBe('unsupported_resource');
    expect(body.error?.type).toBe('invalid_request_error');
  });
});
