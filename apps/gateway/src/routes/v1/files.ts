import type { FastifyPluginAsync } from 'fastify';
import { unsupportedResourceHandler, unsupportedRouteOpts } from './unsupported.js';

const reject = unsupportedResourceHandler(
  'Files',
  'Durable file storage and file_id references are not supported. Inline text or image_url (https / data:) in chat or responses instead.'
);

export const v1FilesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/files', unsupportedRouteOpts, reject);
  fastify.get('/v1/files', unsupportedRouteOpts, reject);
  fastify.get('/v1/files/:file_id', unsupportedRouteOpts, reject);
  fastify.get('/v1/files/:file_id/content', unsupportedRouteOpts, reject);
  fastify.delete('/v1/files/:file_id', unsupportedRouteOpts, reject);
};
