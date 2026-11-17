import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';
import crypto from 'node:crypto';

describe('Governance, Fine-Tuning & Webhooks API', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-governance';
  const keyHash = hashGatewayKey(validKey);

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/v1/fine_tuning/jobs — unsupported', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/fine_tuning/jobs',
        payload: {
          model: 'gpt-4o-mini-2024-07-18',
          training_file: 'file-x',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error?.code).toBe('invalid_api_key');
    });

    it('returns 501 unsupported_resource', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/fine_tuning/jobs',
        headers: { Authorization: `Bearer ${validKey}` },
        payload: {
          model: 'gpt-4o-mini-2024-07-18',
          training_file: 'file-x',
        },
      });

      expect(res.statusCode).toBe(501);
      expect(JSON.parse(res.body).error?.code).toBe('unsupported_resource');
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
