import type { FastifyPluginAsync } from 'fastify';
import { unsupportedResourceHandler, unsupportedRouteOpts } from './unsupported.js';

const reject = unsupportedResourceHandler(
  'Assistants',
  'Assistants are not supported by this gateway. Use stateless /v1/chat/completions or /v1/responses with full context each request.'
);

export const v1AssistantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/assistants', unsupportedRouteOpts, reject);
  fastify.get('/v1/assistants', unsupportedRouteOpts, reject);
  fastify.get('/v1/assistants/:assistant_id', unsupportedRouteOpts, reject);
  fastify.post('/v1/assistants/:assistant_id', unsupportedRouteOpts, reject);
  fastify.delete('/v1/assistants/:assistant_id', unsupportedRouteOpts, reject);
};
