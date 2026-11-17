import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('Files & Uploads API — unsupported', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-files';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-files-1',
      name: 'Test Files Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated files with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/files',
      payload: {},
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error?.code).toBe('invalid_api_key');
  });

  it('returns 501 for /v1/files', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/files',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {},
    });

    expect(res.statusCode).toBe(501);
    expect(JSON.parse(res.body).error?.code).toBe('unsupported_resource');
  });

  it('returns 501 for /v1/uploads', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: { filename: 'a.bin', bytes: 1, purpose: 'assistants' },
    });

    expect(res.statusCode).toBe(501);
    expect(JSON.parse(res.body).error?.code).toBe('unsupported_resource');
  });
});
