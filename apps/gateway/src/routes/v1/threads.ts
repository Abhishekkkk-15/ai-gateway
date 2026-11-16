import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError } from '@ai-gateway/core';

export const v1ThreadsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/threads
  fastify.post<{
    Body: { metadata?: Record<string, unknown> };
  }>(
    '/v1/threads',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const thread = await fastify.assistantRunnerService.createThread(request.body);
      return reply.status(200).send(thread);
    }
  );

  // GET /v1/threads/:thread_id
  fastify.get<{ Params: { thread_id: string } }>(
    '/v1/threads/:thread_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { thread_id } = request.params;
      const thread = await fastify.assistantRunnerService.getThread(thread_id);
      if (!thread) {
        return reply.status(404).send(
          createOpenAIError(`No such thread: '${thread_id}'`, 404, 'invalid_request_error')
        );
      }
      return reply.status(200).send(thread);
    }
  );

  // DELETE /v1/threads/:thread_id
  fastify.delete<{ Params: { thread_id: string } }>(
    '/v1/threads/:thread_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { thread_id } = request.params;
      await fastify.assistantRunnerService.deleteThread(thread_id);
      return reply.status(200).send({
        id: thread_id,
        object: 'thread.deleted',
        deleted: true,
      });
    }
  );

  // POST /v1/threads/:thread_id/messages
  fastify.post<{
    Params: { thread_id: string };
    Body: { role: 'user' | 'assistant'; content: string };
  }>(
    '/v1/threads/:thread_id/messages',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { thread_id } = request.params;
      const body = request.body;
      if (!body || !body.role || !body.content) {
        return reply.status(400).send(
          createOpenAIError('Missing role or content.', 400, 'invalid_request_error')
        );
      }

      const msg = await fastify.assistantRunnerService.createMessage(thread_id, body);
      return reply.status(200).send(msg);
    }
  );

  // GET /v1/threads/:thread_id/messages
  fastify.get<{ Params: { thread_id: string } }>(
    '/v1/threads/:thread_id/messages',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { thread_id } = request.params;
      const messages = await fastify.assistantRunnerService.listMessages(thread_id);
      return reply.status(200).send({
        object: 'list',
        data: messages,
        has_more: false,
      });
    }
  );

  // POST /v1/threads/:thread_id/runs
  fastify.post<{
    Params: { thread_id: string };
    Body: {
      assistant_id?: string;
      model?: string;
      instructions?: string;
    };
  }>(
    '/v1/threads/:thread_id/runs',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { thread_id } = request.params;
      const body = request.body || {};

      let requestedModel = body.model || 'gpt-4o';
      if (!body.model && body.assistant_id) {
        const asst = await fastify.assistantRunnerService.getAssistant(body.assistant_id);
        if (asst) requestedModel = asst.model;
      }

      const route = fastify.routingCache.resolveModel(requestedModel);
      if (!route) {
        const errorMsg = fastify.routingCache.explainMissingModel(requestedModel);
        return reply.status(404).send(
          createOpenAIError(errorMsg, 404, 'invalid_request_error', 'model_not_found')
        );
      }

      const { model, provider, adapter } = route;

      try {
        const run = await fastify.assistantRunnerService.createRun(thread_id, {
          assistantId: body.assistant_id,
          model,
          provider,
          adapter,
          instructions: body.instructions,
        });

        return reply.status(200).send(run);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Run execution failed';
        return reply.status(500).send(createOpenAIError(message, 500, 'run_error'));
      }
    }
  );
};
