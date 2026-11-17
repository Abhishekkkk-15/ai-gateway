import type { FastifyPluginAsync } from 'fastify';
import { unsupportedResourceHandler, unsupportedRouteOpts } from './unsupported.js';

const reject = unsupportedResourceHandler(
  'Threads',
  'Assistants threads/runs are not supported by this gateway. Use stateless chat or responses with full context each request.'
);

export const v1ThreadsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/threads', unsupportedRouteOpts, reject);
  fastify.get('/v1/threads/:thread_id', unsupportedRouteOpts, reject);
  fastify.post('/v1/threads/:thread_id', unsupportedRouteOpts, reject);
  fastify.delete('/v1/threads/:thread_id', unsupportedRouteOpts, reject);
  fastify.post('/v1/threads/:thread_id/messages', unsupportedRouteOpts, reject);
  fastify.get('/v1/threads/:thread_id/messages', unsupportedRouteOpts, reject);
  fastify.post('/v1/threads/:thread_id/runs', unsupportedRouteOpts, reject);
  fastify.get('/v1/threads/:thread_id/runs', unsupportedRouteOpts, reject);
  fastify.get('/v1/threads/:thread_id/runs/:run_id', unsupportedRouteOpts, reject);
  fastify.post('/v1/threads/:thread_id/runs/:run_id/cancel', unsupportedRouteOpts, reject);
};
