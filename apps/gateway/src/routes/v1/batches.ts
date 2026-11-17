import type { FastifyPluginAsync } from 'fastify';
import { unsupportedResourceHandler, unsupportedRouteOpts } from './unsupported.js';

const reject = unsupportedResourceHandler(
  'Batches',
  'Batches are not supported by this gateway. Run chat/completions synchronously instead.'
);

export const v1BatchesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/batches', unsupportedRouteOpts, reject);
  fastify.get('/v1/batches', unsupportedRouteOpts, reject);
  fastify.get('/v1/batches/:batch_id', unsupportedRouteOpts, reject);
  fastify.post('/v1/batches/:batch_id/cancel', unsupportedRouteOpts, reject);
};
