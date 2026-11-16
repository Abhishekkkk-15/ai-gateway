import type { FastifyPluginAsync } from 'fastify';
import { authenticateAdmin } from './auth.js';
import { requestLogsTable, desc, count } from '@ai-gateway/db';

export const adminLogsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: { limit?: string; offset?: string; providerId?: string };
  }>('/api/admin/logs', { preHandler: authenticateAdmin }, async (request) => {
    const limit = Math.min(Math.max(parseInt(request.query.limit || '50', 10), 1), 500);
    const offset = Math.max(parseInt(request.query.offset || '0', 10), 0);

    if (fastify.db) {
      try {
        const [rows, countRows] = await Promise.all([
          fastify.db
            .select()
            .from(requestLogsTable)
            .orderBy(desc(requestLogsTable.timestamp))
            .limit(limit)
            .offset(offset),
          fastify.db.select({ count: count() }).from(requestLogsTable),
        ]);

        const total = Number(countRows[0]?.count || 0);
        return { logs: rows, total, limit, offset };
      } catch (err) {
        console.error('[AdminLogs] Error fetching logs:', err);
      }
    }

    return { logs: [], total: 0, limit, offset };
  });
};
