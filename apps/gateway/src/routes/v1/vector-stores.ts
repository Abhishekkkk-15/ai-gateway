import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError } from '@ai-gateway/core';

export const v1VectorStoresRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/vector_stores (Create vector store)
  fastify.post<{
    Body: {
      name?: string;
      file_ids?: string[];
      metadata?: Record<string, unknown>;
      expires_after?: { anchor: string; days: number };
    };
  }>(
    '/v1/vector_stores',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const body = request.body || {};
      const store = await fastify.vectorStoreService.createVectorStore({
        name: body.name,
        fileIds: body.file_ids,
        metadata: body.metadata,
        expiresAfter: body.expires_after,
      });
      return reply.status(200).send(store);
    }
  );

  // GET /v1/vector_stores (List vector stores)
  fastify.get(
    '/v1/vector_stores',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const stores = await fastify.vectorStoreService.listVectorStores();
      return reply.status(200).send({
        object: 'list',
        data: stores,
        has_more: false,
      });
    }
  );

  // GET /v1/vector_stores/:vector_store_id (Retrieve vector store)
  fastify.get<{ Params: { vector_store_id: string } }>(
    '/v1/vector_stores/:vector_store_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { vector_store_id } = request.params;
      const store = await fastify.vectorStoreService.getVectorStore(vector_store_id);
      if (!store) {
        return reply.status(404).send(
          createOpenAIError(`No such vector store: '${vector_store_id}'`, 404, 'invalid_request_error')
        );
      }
      return reply.status(200).send(store);
    }
  );

  // POST /v1/vector_stores/:vector_store_id (Modify vector store)
  fastify.post<{
    Params: { vector_store_id: string };
    Body: { name?: string; metadata?: Record<string, unknown> };
  }>(
    '/v1/vector_stores/:vector_store_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { vector_store_id } = request.params;
      const body = request.body || {};
      const store = await fastify.vectorStoreService.updateVectorStore(vector_store_id, body);
      if (!store) {
        return reply.status(404).send(
          createOpenAIError(`No such vector store: '${vector_store_id}'`, 404, 'invalid_request_error')
        );
      }
      return reply.status(200).send(store);
    }
  );

  // DELETE /v1/vector_stores/:vector_store_id
  fastify.delete<{ Params: { vector_store_id: string } }>(
    '/v1/vector_stores/:vector_store_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { vector_store_id } = request.params;
      await fastify.vectorStoreService.deleteVectorStore(vector_store_id);
      return reply.status(200).send({
        id: vector_store_id,
        object: 'vector_store.deleted',
        deleted: true,
      });
    }
  );

  // POST /v1/vector_stores/:vector_store_id/files (Add file to vector store)
  fastify.post<{
    Params: { vector_store_id: string };
    Body: { file_id: string };
  }>(
    '/v1/vector_stores/:vector_store_id/files',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { vector_store_id } = request.params;
      const { file_id } = request.body || {};
      if (!file_id) {
        return reply.status(400).send(
          createOpenAIError('Missing file_id in request body.', 400, 'invalid_request_error')
        );
      }

      const file = await fastify.vectorStoreService.addFileToStore(vector_store_id, file_id);
      if (!file) {
        return reply.status(404).send(
          createOpenAIError(`No such vector store: '${vector_store_id}'`, 404, 'invalid_request_error')
        );
      }

      return reply.status(200).send(file);
    }
  );

  // GET /v1/vector_stores/:vector_store_id/files (List files in store)
  fastify.get<{ Params: { vector_store_id: string } }>(
    '/v1/vector_stores/:vector_store_id/files',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { vector_store_id } = request.params;
      const files = await fastify.vectorStoreService.listFiles(vector_store_id);
      return reply.status(200).send({
        object: 'list',
        data: files,
        has_more: false,
      });
    }
  );

  // GET /v1/vector_stores/:vector_store_id/files/:file_id
  fastify.get<{ Params: { vector_store_id: string; file_id: string } }>(
    '/v1/vector_stores/:vector_store_id/files/:file_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { vector_store_id, file_id } = request.params;
      const file = await fastify.vectorStoreService.getFile(vector_store_id, file_id);
      if (!file) {
        return reply.status(404).send(
          createOpenAIError(`File '${file_id}' not found in vector store '${vector_store_id}'`, 404, 'invalid_request_error')
        );
      }
      return reply.status(200).send(file);
    }
  );

  // DELETE /v1/vector_stores/:vector_store_id/files/:file_id
  fastify.delete<{ Params: { vector_store_id: string; file_id: string } }>(
    '/v1/vector_stores/:vector_store_id/files/:file_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { vector_store_id, file_id } = request.params;
      await fastify.vectorStoreService.removeFile(vector_store_id, file_id);
      return reply.status(200).send({
        id: file_id,
        object: 'vector_store.file.deleted',
        deleted: true,
      });
    }
  );

  // POST /v1/vector_stores/:vector_store_id/file_batches
  fastify.post<{
    Params: { vector_store_id: string };
    Body: { file_ids: string[] };
  }>(
    '/v1/vector_stores/:vector_store_id/file_batches',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { vector_store_id } = request.params;
      const { file_ids } = request.body || {};
      if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
        return reply.status(400).send(
          createOpenAIError('Missing file_ids array.', 400, 'invalid_request_error')
        );
      }

      const batch = await fastify.vectorStoreService.createFileBatch(vector_store_id, file_ids);
      if (!batch) {
        return reply.status(404).send(
          createOpenAIError(`No such vector store: '${vector_store_id}'`, 404, 'invalid_request_error')
        );
      }

      return reply.status(200).send(batch);
    }
  );

  // GET /v1/vector_stores/:vector_store_id/file_batches/:batch_id
  fastify.get<{ Params: { vector_store_id: string; batch_id: string } }>(
    '/v1/vector_stores/:vector_store_id/file_batches/:batch_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { vector_store_id, batch_id } = request.params;
      const batch = await fastify.vectorStoreService.getFileBatch(vector_store_id, batch_id);
      if (!batch) {
        return reply.status(404).send(
          createOpenAIError(`No such file batch: '${batch_id}'`, 404, 'invalid_request_error')
        );
      }
      return reply.status(200).send(batch);
    }
  );
};
