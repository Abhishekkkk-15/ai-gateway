import type { FastifyPluginAsync } from 'fastify';
import { authenticateAdmin } from './auth.js';
import { gatewayKeysTable, hashGatewayKey, eq, type InsertGatewayKeyRow } from '@ai-gateway/db';
import crypto from 'node:crypto';

export const adminGatewayKeysRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/admin/gateway-keys
  fastify.get('/api/admin/gateway-keys', { preHandler: authenticateAdmin }, async () => {
    if (fastify.db) {
      try {
        const rows = await fastify.db.select().from(gatewayKeysTable);
        return {
          keys: rows.map((r) => ({
            id: r.id,
            name: r.name,
            prefix: r.prefix,
            rateLimitRpm: r.rateLimitRpm,
            isEnabled: r.isEnabled,
            lastUsedAt: r.lastUsedAt,
            expiresAt: r.expiresAt,
            createdAt: r.createdAt,
          })),
        };
      } catch (err) {
        console.error('[AdminGatewayKeys] DB fetch error:', err);
      }
    }

    return { keys: fastify.routingCache.listGatewayKeys() };
  });

  // POST /api/admin/gateway-keys
  fastify.post<{
    Body: { name?: string; rateLimitRpm?: number; expiresInDays?: number };
  }>('/api/admin/gateway-keys', { preHandler: authenticateAdmin }, async (request, reply) => {
    const { name = 'Default Key', rateLimitRpm, expiresInDays } = request.body || {};

    const id = crypto.randomUUID();
    const rawSecret = crypto.randomBytes(24).toString('hex');
    const apiKey = `sk-gw-${rawSecret}`;
    const keyHash = hashGatewayKey(apiKey);
    const prefix = `sk-gw-${rawSecret.slice(0, 4)}...`;

    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

    const keyRow: InsertGatewayKeyRow = {
      id,
      name,
      keyHash,
      prefix,
      rateLimitRpm: rateLimitRpm || null,
      isEnabled: true,
      expiresAt,
      createdAt: new Date(),
    };

    if (fastify.db) {
      await fastify.db.insert(gatewayKeysTable).values(keyRow);
      await fastify.routingCache.hydrate();
    } else {
      // In-memory testing fallback
      fastify.routingCache.setGatewayKeyForTesting(keyHash, {
        id,
        name,
        keyHash,
        prefix,
        createdAt: new Date(),
        isEnabled: true,
      });
    }

    return reply.status(201).send({
      id,
      name,
      prefix,
      apiKey, // Returned ONLY on creation
      createdAt: keyRow.createdAt,
      message: 'Store this API key safely; it cannot be retrieved again.',
    });
  });

  // DELETE /api/admin/gateway-keys/:id
  fastify.delete<{ Params: { id: string } }>(
    '/api/admin/gateway-keys/:id',
    { preHandler: authenticateAdmin },
    async (request, reply) => {
      const { id } = request.params;
      if (!fastify.db) {
        return reply.status(503).send({ error: 'Database not connected.' });
      }

      await fastify.db.delete(gatewayKeysTable).where(eq(gatewayKeysTable.id, id));
      await fastify.routingCache.hydrate();

      return { message: 'Gateway key revoked successfully.' };
    }
  );

  // PATCH /api/admin/gateway-keys/:id
  fastify.patch<{
    Params: { id: string };
    Body: { isEnabled?: boolean; name?: string };
  }>('/api/admin/gateway-keys/:id', { preHandler: authenticateAdmin }, async (request, reply) => {
    const { id } = request.params;
    const { isEnabled, name } = request.body || {};

    if (!fastify.db) {
      return reply.status(503).send({ error: 'Database not connected.' });
    }

    const updates: Partial<InsertGatewayKeyRow> = {};
    if (isEnabled !== undefined) updates.isEnabled = isEnabled;
    if (name) updates.name = name;

    await fastify.db.update(gatewayKeysTable).set(updates).where(eq(gatewayKeysTable.id, id));
    await fastify.routingCache.hydrate();

    return { message: 'Gateway key updated successfully.' };
  });
};
