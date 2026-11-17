import type { FastifyPluginAsync } from 'fastify';
import { unsupportedResourceHandler, unsupportedRouteOpts } from './unsupported.js';

const reject = unsupportedResourceHandler(
  'Fine-tuning',
  'Fine-tuning jobs are not supported by this gateway.'
);

export const v1FineTuningRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/fine_tuning/jobs', unsupportedRouteOpts, reject);
  fastify.get('/v1/fine_tuning/jobs', unsupportedRouteOpts, reject);
  fastify.get('/v1/fine_tuning/jobs/:id', unsupportedRouteOpts, reject);
  fastify.post('/v1/fine_tuning/jobs/:id/cancel', unsupportedRouteOpts, reject);
};
