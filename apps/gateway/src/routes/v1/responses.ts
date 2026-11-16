import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError } from '@ai-gateway/core';

export const v1ResponsesRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/responses (Create next-generation response)
  fastify.post<{
    Body: {
      model?: string;
      input?: string | any[];
      previous_response_id?: string;
      conversation?: string;
      instructions?: string;
      stream?: boolean;
    };
  }>(
    '/v1/responses',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const body = request.body;
      if (!body || !body.model) {
        return reply.status(400).send(
          createOpenAIError('The model parameter is required.', 400, 'invalid_request_error')
        );
      }

      if (body.input === undefined || body.input === null || body.input === '') {
        return reply.status(400).send(
          createOpenAIError('The input parameter is required and cannot be empty.', 400, 'invalid_request_error')
        );
      }

      const route = fastify.routingCache.resolveModel(body.model);
      if (!route) {
        const errorMsg = fastify.routingCache.explainMissingModel(body.model);
        return reply.status(404).send(
          createOpenAIError(errorMsg, 404, 'invalid_request_error', 'model_not_found')
        );
      }

      const { model, provider, adapter } = route;

      const abortController = new AbortController();
      request.raw.on('close', () => {
        if (!reply.raw.writableEnded) {
          abortController.abort();
        }
      });
      if (request.signal) {
        request.signal.addEventListener('abort', () => abortController.abort());
      }

      try {
        const result = await fastify.responsesEngineService.generateResponse({
          model,
          provider,
          adapter,
          input: body.input,
          previousResponseId: body.previous_response_id,
          conversationId: body.conversation,
          instructions: body.instructions,
          stream: body.stream,
          signal: abortController.signal,
        });

        if (result.isStream) {
          reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
          reply.raw.setHeader('Connection', 'keep-alive');
          reply.raw.setHeader('X-Accel-Buffering', 'no');

          const reader = (result.stream as any).getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            reply.raw.write(value);
          }
          reply.raw.end();
          return reply;
        } else {
          return reply.status(200).send(result.data);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Responses execution failed';
        return reply.status(500).send(createOpenAIError(message, 500, 'responses_error'));
      }
    }
  );

  // GET /v1/responses/:response_id
  fastify.get<{ Params: { response_id: string } }>(
    '/v1/responses/:response_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { response_id } = request.params;
      const resp = await fastify.responsesEngineService.getResponse(response_id);
      if (!resp) {
        return reply.status(404).send(
          createOpenAIError(`No such response: '${response_id}'`, 404, 'invalid_request_error')
        );
      }
      return reply.status(200).send(resp);
    }
  );

  // DELETE /v1/responses/:response_id
  fastify.delete<{ Params: { response_id: string } }>(
    '/v1/responses/:response_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { response_id } = request.params;
      await fastify.responsesEngineService.deleteResponse(response_id);
      return reply.status(200).send({
        id: response_id,
        object: 'response.deleted',
        deleted: true,
      });
    }
  );
};
