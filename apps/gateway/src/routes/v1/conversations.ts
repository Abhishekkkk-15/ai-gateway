import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError } from '@ai-gateway/core';

const STATELESS_CONVERSATIONS_MSG =
  'Conversations are not supported in this gateway deployment. This gateway is stateless — include full context in each Responses `input` instead of using conversation ids.';

async function rejectStateless(_request: unknown, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) {
  return reply.status(400).send(
    createOpenAIError(STATELESS_CONVERSATIONS_MSG, 400, 'invalid_request_error', 'stateless_unsupported')
  );
}

export const v1ConversationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/conversations', { preHandler: authenticateGatewayKey }, rejectStateless);
  fastify.get('/v1/conversations/:conversation_id', { preHandler: authenticateGatewayKey }, rejectStateless);
  fastify.post('/v1/conversations/:conversation_id/items', { preHandler: authenticateGatewayKey }, rejectStateless);
  fastify.delete('/v1/conversations/:conversation_id', { preHandler: authenticateGatewayKey }, rejectStateless);
};
