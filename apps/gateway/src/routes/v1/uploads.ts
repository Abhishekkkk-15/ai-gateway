import type { FastifyPluginAsync } from 'fastify';
import { unsupportedResourceHandler, unsupportedRouteOpts } from './unsupported.js';

const reject = unsupportedResourceHandler(
  'Uploads',
  'Resumable uploads are not supported by this gateway.'
);

export const v1UploadsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/uploads', unsupportedRouteOpts, reject);
  fastify.post('/v1/uploads/:upload_id/parts', unsupportedRouteOpts, reject);
  fastify.post('/v1/uploads/:upload_id/complete', unsupportedRouteOpts, reject);
  fastify.delete('/v1/uploads/:upload_id', unsupportedRouteOpts, reject);
};