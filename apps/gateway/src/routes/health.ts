import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      loadedModels: fastify.routingCache.getLoadedModelsCount(),
      timestamp: new Date().toISOString(),
    };
  });
};
