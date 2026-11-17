import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';

describe('Admin REST API (/api/admin/*)', () => {
  let app: FastifyInstance;
  let adminCookie: string;

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'supersecretadminpassword123';
    process.env.JWT_SECRET = 'jwt-super-secret-key-at-least-32-chars!!';
    process.env.MASTER_SECRET = 'master-secret-key-at-least-32-chars-long!!';

    app = await buildServer({ skipDbHydration: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects login with incorrect password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { username: 'admin', password: 'wrongpassword' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('authenticates admin and issues signed session cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { username: 'admin', password: 'supersecretadminpassword123' },
    });

    expect(res.statusCode).toBe(200);
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    adminCookie = Array.isArray(cookies) ? cookies[0] : (cookies as string);
  });

  it('rejects unauthenticated access to /api/admin/providers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/providers',
    });
    expect(res.statusCode).toBe(401);
  });

  it('allows authenticated access to /api/admin/providers with cookie', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/providers',
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.providers)).toBe(true);

    // OpenAI-compatible presets appear without dedicated packages
    const groq = body.providers.find((p: { id: string }) => p.id === 'groq');
    const nvidia = body.providers.find((p: { id: string }) => p.id === 'nvidia');
    expect(groq?.adapterType).toBe('openai-compatible');
    expect(groq?.isPreset).toBe(true);
    expect(nvidia?.adapterType).toBe('openai-compatible');
    expect(Array.isArray(body.presets)).toBe(true);
    expect(body.presets.some((p: { id: string }) => p.id === 'groq')).toBe(true);
  });

  it('creates and manages gateway keys via /api/admin/gateway-keys', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/gateway-keys',
      headers: { cookie: adminCookie },
      payload: { name: 'Dashboard Client Key' },
    });

    expect(createRes.statusCode).toBe(201);
    const createdKey = JSON.parse(createRes.body);
    expect(createdKey.apiKey).toMatch(/^sk-gw-/);
    expect(createdKey.id).toBeDefined();

    // List keys
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/admin/gateway-keys',
      headers: { cookie: adminCookie },
    });
    expect(listRes.statusCode).toBe(200);
    const keys = JSON.parse(listRes.body).keys;
    expect(keys.some((k: { id: string }) => k.id === createdKey.id)).toBe(true);
  });
});
