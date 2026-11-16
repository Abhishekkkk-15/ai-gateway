import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('Batches API (/v1/batches)', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-batches';
  const keyHash = hashGatewayKey(validKey);
  let inputFileId: string;

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

    // Seed mock model for internal batch execution
    app.routingCache.setModelForTesting('mock/batch-model', {
      model: {
        id: 'batch-model',
        providerId: 'mock-provider',
        slug: 'mock/batch-model',
        displayName: 'Batch Model',
        capabilities: ['chat'],
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

    // Create a batch input .jsonl file in storage
    const lines = [
      JSON.stringify({
        custom_id: 'req-1',
        method: 'POST',
        url: '/v1/chat/completions',
        body: { model: 'mock/batch-model', messages: [{ role: 'user', content: 'Item 1' }] },
      }),
      JSON.stringify({
        custom_id: 'req-2',
        method: 'POST',
        url: '/v1/chat/completions',
        body: { model: 'mock/batch-model', messages: [{ role: 'user', content: 'Item 2' }] },
      }),
    ].join('\n');

    const file = await app.storageService.saveFile({
      filename: 'batch_requests.jsonl',
      purpose: 'batch',
      mimeType: 'application/jsonl',
      buffer: Buffer.from(lines, 'utf-8'),
    });

    inputFileId = file.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/batches',
      payload: {
        input_file_id: inputFileId,
        endpoint: '/v1/chat/completions',
        completion_window: '24h',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error?.code).toBe('invalid_api_key');
  });

  it('creates an asynchronous batch and processes requests', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/batches',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        input_file_id: inputFileId,
        endpoint: '/v1/chat/completions',
        completion_window: '24h',
        metadata: { customer_id: 'cust_123' },
      },
    });

    expect(res.statusCode).toBe(200);
    const batch = JSON.parse(res.body);
    expect(batch.id).toMatch(/^batch_[a-zA-Z0-9_-]+$/);
    expect(batch.object).toBe('batch');
    expect(batch.endpoint).toBe('/v1/chat/completions');
    expect(batch.input_file_id).toBe(inputFileId);
    expect(batch.status).toMatch(/validating|in_progress|completed/);
    expect(batch.request_counts.total).toBe(2);

    const batchId = batch.id;

    // Retrieve batch
    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/batches/${batchId}`,
      headers: { Authorization: `Bearer ${validKey}` },
    });

    expect(getRes.statusCode).toBe(200);
    const retrieved = JSON.parse(getRes.body);
    expect(retrieved.id).toBe(batchId);
    expect(retrieved.metadata?.customer_id).toBe('cust_123');
  });

  it('lists batches with list envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/batches',
      headers: { Authorization: `Bearer ${validKey}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.object).toBe('list');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('cancels a batch', async () => {
    // Create new batch to cancel
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/batches',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        input_file_id: inputFileId,
        endpoint: '/v1/chat/completions',
        completion_window: '24h',
      },
    });

    const batch = JSON.parse(createRes.body);

    const cancelRes = await app.inject({
      method: 'POST',
      url: `/v1/batches/${batch.id}/cancel`,
      headers: { Authorization: `Bearer ${validKey}` },
    });

    expect(cancelRes.statusCode).toBe(200);
    const cancelled = JSON.parse(cancelRes.body);
    expect(cancelled.status).toBe('cancelled');
  });
});
