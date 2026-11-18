import type { FastifyPluginAsync } from 'fastify';
import { authenticateAdmin } from './auth.js';
import { modelsTable, providersTable, eq, type InsertModelRow } from '@ai-gateway/db';
import type { ModelCapability } from '@ai-gateway/core';

const MODEL_CAPABILITIES: ModelCapability[] = [
  'chat',
  'embeddings',
  'stt',
  'tts',
  'vision',
  'tools',
];

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  );
}

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

  // POST /api/admin/models
  // Manual catalog entry, used when a provider's model discovery is unavailable.
  fastify.post<{
    Body: {
      providerId?: string;
      modelId?: string;
      displayName?: string;
      capabilities?: string[];
      contextWindow?: number | string | null;
      customAlias?: string | null;
      isEnabled?: boolean;
    };
  }>('/api/admin/models', { preHandler: authenticateAdmin }, async (request, reply) => {
    const body = request.body || {};
    const providerId = typeof body.providerId === 'string' ? body.providerId.trim() : '';
    const rawModelId = typeof body.modelId === 'string' ? body.modelId.trim() : '';

    if (!providerId) {
      return reply.status(400).send({ error: 'Provider is required.' });
    }

    if (!rawModelId) {
      return reply.status(400).send({ error: 'Upstream model ID is required.' });
    }

    if (/\s/.test(rawModelId)) {
      return reply.status(400).send({ error: 'Model ID cannot contain spaces.' });
    }

    if (!fastify.db) {
      return reply.status(503).send({ error: 'Database not connected.' });
    }

    const providerRows = await fastify.db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (providerRows.length === 0) {
      return reply.status(400).send({
        error: `Provider '${providerId}' is not saved yet. Configure it on the Providers page first.`,
      });
    }

    // Accept either "llama-3.3-70b" or the full "groq/llama-3.3-70b" form.
    const modelId = rawModelId.startsWith(`${providerId}/`)
      ? rawModelId.slice(providerId.length + 1)
      : rawModelId;
    const slug = `${providerId}/${modelId}`;

    const existingRows = await fastify.db
      .select()
      .from(modelsTable)
      .where(eq(modelsTable.slug, slug))
      .limit(1);

    if (existingRows.length > 0) {
      return reply.status(409).send({
        error: `Model '${slug}' already exists in the catalog. Edit it instead, or use a different model ID.`,
      });
    }

    const requestedCapabilities = Array.isArray(body.capabilities)
      ? body.capabilities.filter((cap): cap is string => typeof cap === 'string')
      : [];

    const invalidCapabilities = requestedCapabilities.filter(
      (cap) => !MODEL_CAPABILITIES.includes(cap as ModelCapability)
    );

    if (invalidCapabilities.length > 0) {
      return reply.status(400).send({
        error: `Unknown capability: ${invalidCapabilities.join(', ')}. Valid values: ${MODEL_CAPABILITIES.join(', ')}.`,
      });
    }

    const capabilities = Array.from(new Set(requestedCapabilities)) as ModelCapability[];
    if (capabilities.length === 0) {
      capabilities.push('chat');
    }

    const parsedContextWindow =
      body.contextWindow === null || body.contextWindow === undefined || body.contextWindow === ''
        ? null
        : Number(body.contextWindow);

    const contextWindow =
      parsedContextWindow !== null && Number.isFinite(parsedContextWindow)
        ? Math.max(1, Math.floor(parsedContextWindow))
        : null;

    const customAlias =
      typeof body.customAlias === 'string' && body.customAlias.trim()
        ? body.customAlias.trim().toLowerCase()
        : null;

    const displayName =
      typeof body.displayName === 'string' && body.displayName.trim()
        ? body.displayName.trim()
        : modelId;

    const payload: InsertModelRow = {
      slug,
      modelId,
      providerId,
      displayName,
      capabilities,
      contextWindow,
      customAlias,
      isEnabled: body.isEnabled !== false,
      updatedAt: new Date(),
    };

    try {
      await fastify.db.insert(modelsTable).values(payload);
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        return reply.status(409).send({
          error: customAlias
            ? `Model '${slug}' or alias '${customAlias}' already exists in the catalog.`
            : `Model '${slug}' already exists in the catalog.`,
        });
      }
      throw err;
    }

    // Refresh memory cache so the new model is routable immediately.
    await fastify.routingCache.hydrate();

    return reply.status(201).send({
      message: `Model '${slug}' added to the catalog.`,
      model: payload,
    });
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
