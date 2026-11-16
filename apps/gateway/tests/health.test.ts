import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';

describe('Health Route (GET /health)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns ok status and loaded model count', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.loadedModels).toBe('number');
  });
});
