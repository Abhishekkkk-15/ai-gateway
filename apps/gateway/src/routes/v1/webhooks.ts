import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';

export const v1WebhooksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/webhooks', async (request, reply) => {
    const webhookId = request.headers['webhook-id'] as string;
    const webhookTimestamp = request.headers['webhook-timestamp'] as string;
    const webhookSignature = request.headers['webhook-signature'] as string;

    const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    const secret = process.env.OPENAI_WEBHOOK_SECRET || 'whsec_test_secret_123456';

    let verified = false;

    if (webhookSignature && webhookTimestamp) {
      // Parse signature parts, e.g. "t=1710000000,v1=abcdef..."
      const parts = webhookSignature.split(',');
      const signatureMap = new Map<string, string>();
      for (const p of parts) {
        const [k, v] = p.split('=');
        if (k && v) signatureMap.set(k.trim(), v.trim());
      }

      const expectedTimestamp = signatureMap.get('t') || webhookTimestamp;
      const signatureHex = signatureMap.get('v1');

      if (signatureHex) {
        const signedPayload = `${expectedTimestamp}.${rawBody}`;
        const computedHmac = crypto
          .createHmac('sha256', secret)
          .update(signedPayload)
          .digest('hex');

        if (computedHmac === signatureHex) {
          verified = true;
        }
      }
    }

    return reply.status(200).send({
      received: true,
      verified,
    });
  });
};
