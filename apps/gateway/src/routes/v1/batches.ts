import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError } from '@ai-gateway/core';

export const v1BatchesRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/batches (Create asynchronous batch)
  fastify.post<{
    Body: {
      input_file_id: string;
      endpoint: string;
      completion_window?: string;
      metadata?: Record<string, unknown>;
    };
  }>(
    '/v1/batches',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const body = request.body;
      if (!body || !body.input_file_id || !body.endpoint) {
        return reply.status(400).send(
          createOpenAIError('Missing required parameters: input_file_id, endpoint.', 400, 'invalid_request_error')
        );
      }

      const batch = await fastify.batchProcessorService.createBatch({
        inputFileId: body.input_file_id,
        endpoint: body.endpoint,
        completionWindow: body.completion_window,
        metadata: body.metadata,
      });

      return reply.status(200).send(batch);
    }
  );

  // GET /v1/batches (List batches)
  fastify.get(
    '/v1/batches',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const batches = await fastify.batchProcessorService.listBatches();
      return reply.status(200).send({
        object: 'list',
        data: batches,
        has_more: false,
      });
    }
  );

  // GET /v1/batches/:batch_id (Retrieve batch)
  fastify.get<{ Params: { batch_id: string } }>(
    '/v1/batches/:batch_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { batch_id } = request.params;
      const batch = await fastify.batchProcessorService.getBatch(batch_id);
      if (!batch) {
        return reply.status(404).send(
          createOpenAIError(`No such batch: '${batch_id}'`, 404, 'invalid_request_error')
        );
      }
      return reply.status(200).send(batch);
    }
  );

  // POST /v1/batches/:batch_id/cancel (Cancel batch)
  fastify.post<{ Params: { batch_id: string } }>(
    '/v1/batches/:batch_id/cancel',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { batch_id } = request.params;
      const batch = await fastify.batchProcessorService.cancelBatch(batch_id);
      if (!batch) {
        return reply.status(404).send(
          createOpenAIError(`No such batch: '${batch_id}'`, 404, 'invalid_request_error')
        );
      }
      return reply.status(200).send(batch);
    }
  );
};
