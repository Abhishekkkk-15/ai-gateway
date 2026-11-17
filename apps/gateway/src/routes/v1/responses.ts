import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError, createStatelessUnsupportedError } from '@ai-gateway/core';

const STATELESS_MSG =
  'This gateway runs in stateless mode and does not store responses or conversations. Send the full context in `input` on each request. `previous_response_id` and `conversation` are not supported.';

export const v1ResponsesRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/responses (stateless create)
  fastify.post<{
    Body: {
      model?: string;
      input?: string | unknown[];
      previous_response_id?: string;
      conversation?: string;
      instructions?: string;
      stream?: boolean;
      temperature?: number;
      max_output_tokens?: number;
      tools?: unknown[];
      tool_choice?: unknown;
      response_format?: { type: string; [key: string]: unknown };
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
          createOpenAIError(
            'The input parameter is required and cannot be empty.',
            400,
            'invalid_request_error'
          )
        );
      }

      if (body.previous_response_id || body.conversation) {
        return reply.status(400).send(createStatelessUnsupportedError(STATELESS_MSG));
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
          instructions: body.instructions,
          stream: body.stream,
          temperature: body.temperature,
          maxOutputTokens: body.max_output_tokens,
          tools: body.tools,
          toolChoice: body.tool_choice,
          responseFormat: body.response_format,
          signal: abortController.signal,
        });

        if (result.isStream) {
          reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
          reply.raw.setHeader('Connection', 'keep-alive');
          reply.raw.setHeader('X-Accel-Buffering', 'no');

          const reader = result.stream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            reply.raw.write(value);
          }
          reply.raw.end();
          return reply;
        }

        return reply.status(200).send(result.data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Responses execution failed';
        const status =
          message.includes('Unsupported') ||
          message.includes('required') ||
          message.includes('file_id') ||
          message.includes('input_image')
            ? 400
            : 500;
        return reply
          .status(status)
          .send(
            createOpenAIError(
              message,
              status,
              status === 400 ? 'invalid_request_error' : 'responses_error'
            )
          );
      }
    }
  );

  // GET /v1/responses/:response_id — not supported in stateless mode
  fastify.get<{ Params: { response_id: string } }>(
    '/v1/responses/:response_id',
    { preHandler: authenticateGatewayKey },
    async (_request, reply) => {
      return reply.status(400).send(
        createStatelessUnsupportedError(
          'This gateway runs in stateless mode and does not store responses. Retrieve is not supported.'
        )
      );
    }
  );

  // DELETE /v1/responses/:response_id — not supported in stateless mode
  fastify.delete<{ Params: { response_id: string } }>(
    '/v1/responses/:response_id',
    { preHandler: authenticateGatewayKey },
    async (_request, reply) => {
      return reply.status(400).send(
        createStatelessUnsupportedError(
          'This gateway runs in stateless mode and does not store responses. Delete is not supported.'
        )
      );
    }
  );
};
