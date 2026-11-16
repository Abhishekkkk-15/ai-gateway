import type { FastifyPluginAsync } from 'fastify';
import { authenticateAdmin } from './auth.js';
import { requestLogsTable, desc } from '@ai-gateway/db';

export const adminLogsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: { limit?: string; providerId?: string };
  }>('/api/admin/logs', { preHandler: authenticateAdmin }, async (request) => {
    const limit = Math.min(parseInt(request.query.limit || '100', 10), 500);

    if (fastify.db) {
      try {
        const rows = await fastify.db
          .select()
          .from(requestLogsTable)
          .orderBy(desc(requestLogsTable.timestamp))
          .limit(limit);

        return { logs: rows };
      } catch (err) {
        console.error('[AdminLogs] Error fetching logs:', err);
      }
    }

    return { logs: [] };
  });
};
