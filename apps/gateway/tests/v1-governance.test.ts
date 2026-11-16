import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';
import crypto from 'node:crypto';

describe('Governance, Fine-Tuning & Webhooks API (/v1/fine_tuning/jobs & /v1/webhooks)', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-governance';
  const keyHash = hashGatewayKey(validKey);
  let sampleTrainingFileId: string;

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-gov-1',
      name: 'Test Governance Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });

    const file = await app.storageService.saveFile({
      filename: 'training_data.jsonl',
      purpose: 'fine-tune',
      mimeType: 'application/jsonl',
      buffer: Buffer.from('{"messages": [{"role": "user", "content": "hi"}]}\n', 'utf-8'),
    });
    sampleTrainingFileId = file.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/v1/fine_tuning/jobs', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/fine_tuning/jobs',
        payload: {
          model: 'gpt-4o-mini-2024-07-18',
          training_file: sampleTrainingFileId,
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error?.code).toBe('invalid_api_key');
    });

    it('creates, lists, retrieves, and cancels a fine-tuning job', async () => {
      // 1. Create job
      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/fine_tuning/jobs',
        headers: { Authorization: `Bearer ${validKey}` },
        payload: {
          model: 'gpt-4o-mini-2024-07-18',
          training_file: sampleTrainingFileId,
          hyperparameters: { n_epochs: 3 },
        },
      });

      expect(createRes.statusCode).toBe(200);
      const job = JSON.parse(createRes.body);
      expect(job.id).toMatch(/^ftjob-[a-zA-Z0-9_-]+$/);
      expect(job.object).toBe('fine_tuning.job');
      expect(job.training_file).toBe(sampleTrainingFileId);
      expect(job.status).toMatch(/validating_files|queued|running|succeeded/);

      const jobId = job.id;

      // 2. List jobs
      const listRes = await app.inject({
        method: 'GET',
        url: '/v1/fine_tuning/jobs',
        headers: { Authorization: `Bearer ${validKey}` },
      });

      expect(listRes.statusCode).toBe(200);
      const list = JSON.parse(listRes.body);
      expect(list.object).toBe('list');
      expect(list.data.some((j: any) => j.id === jobId)).toBe(true);

      // 3. Retrieve specific job
      const getRes = await app.inject({
        method: 'GET',
        url: `/v1/fine_tuning/jobs/${jobId}`,
        headers: { Authorization: `Bearer ${validKey}` },
      });

      expect(getRes.statusCode).toBe(200);
      const retrieved = JSON.parse(getRes.body);
      expect(retrieved.id).toBe(jobId);

      // 4. Cancel job
      const cancelRes = await app.inject({
        method: 'POST',
        url: `/v1/fine_tuning/jobs/${jobId}/cancel`,
        headers: { Authorization: `Bearer ${validKey}` },
      });

      expect(cancelRes.statusCode).toBe(200);
      const cancelled = JSON.parse(cancelRes.body);
      expect(cancelled.status).toBe('cancelled');
    });
  });

  describe('Webhooks & Signature Verification (/v1/webhooks)', () => {
    it('verifies HMAC-SHA256 signed webhooks compatible with client.webhooks.unwrap()', async () => {
      const webhookSecret = 'whsec_test_secret_123456';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payloadString = JSON.stringify({
        id: 'evt_123',
        object: 'event',
        type: 'fine_tuning.job.completed',
        data: { id: 'ftjob-abc' },
      });

      // Compute standard Svix/OpenAI signature: v1,t=<timestamp>,v1=<hmac>
      const signedPayload = `${timestamp}.${payloadString}`;
      const hmac = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      const signatureHeader = `t=${timestamp},v1=${hmac}`;

      const res = await app.inject({
        method: 'POST',
        url: '/v1/webhooks',
        headers: {
          'webhook-id': 'msg_test_123',
          'webhook-timestamp': timestamp,
          'webhook-signature': signatureHeader,
          'Content-Type': 'application/json',
        },
        payload: payloadString,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.received).toBe(true);
      expect(body.verified).toBe(true);
    });
  });
});
