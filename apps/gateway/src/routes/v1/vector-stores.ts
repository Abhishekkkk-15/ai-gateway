import type { FastifyPluginAsync } from 'fastify';
import { unsupportedResourceHandler, unsupportedRouteOpts } from './unsupported.js';

const reject = unsupportedResourceHandler(
  'Vector stores',
  'Vector stores and file search are not supported by this gateway.'
);

export const v1VectorStoresRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/vector_stores', unsupportedRouteOpts, reject);
  fastify.get('/v1/vector_stores', unsupportedRouteOpts, reject);
  fastify.get('/v1/vector_stores/:vector_store_id', unsupportedRouteOpts, reject);
  fastify.post('/v1/vector_stores/:vector_store_id', unsupportedRouteOpts, reject);
  fastify.delete('/v1/vector_stores/:vector_store_id', unsupportedRouteOpts, reject);
  fastify.post('/v1/vector_stores/:vector_store_id/files', unsupportedRouteOpts, reject);
  fastify.get('/v1/vector_stores/:vector_store_id/files', unsupportedRouteOpts, reject);
  fastify.get('/v1/vector_stores/:vector_store_id/files/:file_id', unsupportedRouteOpts, reject);
  fastify.delete('/v1/vector_stores/:vector_store_id/files/:file_id', unsupportedRouteOpts, reject);
  fastify.post('/v1/vector_stores/:vector_store_id/file_batches', unsupportedRouteOpts, reject);
  fastify.get(
    '/v1/vector_stores/:vector_store_id/file_batches/:batch_id',
    unsupportedRouteOpts,
    reject
  );
};
