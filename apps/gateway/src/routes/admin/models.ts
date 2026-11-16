import type { FastifyPluginAsync } from 'fastify';
import { authenticateAdmin } from './auth.js';
import { modelsTable, eq } from '@ai-gateway/db';

export const adminModelsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/admin/models
  fastify.get('/api/admin/models', { preHandler: authenticateAdmin }, async () => {
    if (fastify.db) {
      try {
        const rows = await fastify.db.select().from(modelsTable);
        return { models: rows };
      } catch (err) {
        console.error('[AdminModels] DB fetch error:', err);
      }
    }

    // Fallback to cache models
    return { models: fastify.routingCache.listModels() };
  });

  // PATCH /api/admin/models/*
  fastify.patch<{
    Params: { '*': string };
    Body: { customAlias?: string | null; isEnabled?: boolean };
  }>('/api/admin/models/*', { preHandler: authenticateAdmin }, async (request, reply) => {
    const slug = request.params['*'];
    const { customAlias, isEnabled } = request.body || {};

    if (!slug) {
      return reply.status(400).send({ error: 'Model slug is required.' });
    }

    if (!fastify.db) {
      return reply.status(503).send({ error: 'Database not connected.' });
    }

    const updates: Partial<typeof modelsTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (customAlias !== undefined) {
      updates.customAlias = customAlias ? customAlias.trim().toLowerCase() : null;
    }

    if (isEnabled !== undefined) {
      updates.isEnabled = isEnabled;
    }

    await fastify.db.update(modelsTable).set(updates).where(eq(modelsTable.slug, slug));

    // Refresh memory cache
    await fastify.routingCache.hydrate();

    return { message: 'Model updated successfully', slug };
  });
};
