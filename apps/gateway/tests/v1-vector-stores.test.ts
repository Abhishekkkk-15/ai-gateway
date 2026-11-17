import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('Vector Stores API — unsupported', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-vectorstores';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-vs-1',
      name: 'Test Vector Stores Key',
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
      url: '/v1/vector_stores',
      payload: { name: 'Unauthorized Store' },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error?.code).toBe('invalid_api_key');
  });

  it('returns 501 unsupported_resource', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/vector_stores',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: { name: 'Technical Docs' },
    });

    expect(res.statusCode).toBe(501);
    expect(JSON.parse(res.body).error?.code).toBe('unsupported_resource');
  });
});
