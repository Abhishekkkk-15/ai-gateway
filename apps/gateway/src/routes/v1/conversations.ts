import type { FastifyPluginAsync } from 'fastify';
import { createStatelessUnsupportedError } from '@ai-gateway/core';
import { authenticateGatewayKey } from './auth.js';

const STATELESS_CONVERSATIONS_MSG =
  'Conversations are not supported in this gateway deployment. This gateway is stateless — include full context in each Responses `input` instead of using conversation ids.';

async function rejectStateless(
  _request: unknown,
  reply: { status: (code: number) => { send: (body: unknown) => unknown } }
) {
  return reply.status(400).send(createStatelessUnsupportedError(STATELESS_CONVERSATIONS_MSG));
}

export const v1ConversationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/conversations', { preHandler: authenticateGatewayKey }, rejectStateless);
  fastify.get('/v1/conversations/:conversation_id', { preHandler: authenticateGatewayKey }, rejectStateless);
  fastify.post(
    '/v1/conversations/:conversation_id/items',
    { preHandler: authenticateGatewayKey },
    rejectStateless
  );
  fastify.delete(
    '/v1/conversations/:conversation_id',
    { preHandler: authenticateGatewayKey },
    rejectStateless
  );
};
