import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';

export const v1ModelsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/v1/models', { preHandler: authenticateGatewayKey }, async () => {
    const models = fastify.routingCache.listModels();

    return {
      object: 'list',
      data: models.map((m) => ({
        id: m.slug,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: m.providerId,
        display_name: m.displayName,
        capabilities: m.capabilities,
        context_window: m.contextWindow,
      })),
    };
  });
};
