import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('Assistants & Threads — unsupported', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-assistants';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-asst-1',
      name: 'Test Assistants Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated assistants with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/assistants',
      payload: { model: 'gpt-4o', name: 'Unauthorized Tutor' },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error?.code).toBe('invalid_api_key');
  });

  it('returns 501 for assistants', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/assistants',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: { model: 'gpt-4o', name: 'Math Professor' },
    });

    expect(res.statusCode).toBe(501);
    expect(JSON.parse(res.body).error?.code).toBe('unsupported_resource');
  });

  it('returns 501 for threads', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/threads',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {},
    });

    expect(res.statusCode).toBe(501);
    expect(JSON.parse(res.body).error?.code).toBe('unsupported_resource');
  });
});
