import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError } from '@ai-gateway/core';

export const v1ConversationsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/conversations (Create conversation)
  fastify.post<{
    Body: {
      metadata?: Record<string, unknown>;
    };
  }>(
    '/v1/conversations',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { metadata } = request.body || {};
      const conv = await fastify.responsesEngineService.createConversation(metadata);
      return reply.status(200).send(conv);
    }
  );

  // GET /v1/conversations/:conversation_id
  fastify.get<{ Params: { conversation_id: string } }>(
    '/v1/conversations/:conversation_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { conversation_id } = request.params;
      const conv = await fastify.responsesEngineService.getConversation(conversation_id);
      if (!conv) {
        return reply.status(404).send(
          createOpenAIError(`No such conversation: '${conversation_id}'`, 404, 'invalid_request_error')
        );
      }
      return reply.status(200).send(conv);
    }
  );

  // POST /v1/conversations/:conversation_id/items (Add message item)
  fastify.post<{
    Params: { conversation_id: string };
    Body: { role: string; content: string };
  }>(
    '/v1/conversations/:conversation_id/items',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { conversation_id } = request.params;
      const body = request.body;
      if (!body || !body.role || !body.content) {
        return reply.status(400).send(
          createOpenAIError('Missing role or content.', 400, 'invalid_request_error')
        );
      }

      const item = await fastify.responsesEngineService.addConversationItem(conversation_id, body);
      if (!item) {
        return reply.status(404).send(
          createOpenAIError(`No such conversation: '${conversation_id}'`, 404, 'invalid_request_error')
        );
      }

      return reply.status(200).send(item);
    }
  );

  // DELETE /v1/conversations/:conversation_id
  fastify.delete<{ Params: { conversation_id: string } }>(
    '/v1/conversations/:conversation_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { conversation_id } = request.params;
      await fastify.responsesEngineService.deleteConversation(conversation_id);
      return reply.status(200).send({
        id: conversation_id,
        object: 'conversation.deleted',
        deleted: true,
      });
    }
  );
};
