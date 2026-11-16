import type { FastifyPluginAsync } from 'fastify';
import { authenticateAdmin } from './auth.js';
import {
  providersTable,
  modelsTable,
  encryptSecret,
  eq,
  type InsertProviderRow,
  type InsertModelRow,
} from '@ai-gateway/db';
import type { ProviderConfig } from '@ai-gateway/core';

export const adminProvidersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/admin/providers
  fastify.get('/api/admin/providers', { preHandler: authenticateAdmin }, async () => {
    // Registered adapters from code
    const registeredAdapters = fastify.providerRegistry.list();

    // Stored configs from DB (if available)
    let dbProviders: typeof providersTable.$inferSelect[] = [];
    if (fastify.db) {
      try {
        dbProviders = await fastify.db.select().from(providersTable);
      } catch (err) {
        console.error('[AdminProviders] Error fetching providers from DB:', err);
      }
    }

    const dbProvidersMap = new Map(dbProviders.map((p) => [p.id, p]));

    // Combine built-in adapters with stored DB providers
    const providersList = [];

    // First include all built-in adapters
    for (const adapter of registeredAdapters) {
      const stored = dbProvidersMap.get(adapter.id);
      providersList.push({
        id: adapter.id,
        name: stored?.name || adapter.name,
        adapterType: stored?.adapterType || adapter.id,
        defaultBaseUrl: adapter.defaultBaseUrl,
        baseUrl: stored?.baseUrl || adapter.defaultBaseUrl,
        isConfigured: Boolean(stored?.encryptedApiKey),
        isEnabled: stored ? stored.isEnabled : false,
        supportedCapabilities: adapter.supportedCapabilities,
        isBuiltIn: true,
      });
      dbProvidersMap.delete(adapter.id);
    }

    // Then include any additional custom providers (e.g. custom OpenAI-compatible providers)
    for (const [, stored] of dbProvidersMap) {
      providersList.push({
        id: stored.id,
        name: stored.name,
        adapterType: stored.adapterType,
        defaultBaseUrl: stored.baseUrl || '',
        baseUrl: stored.baseUrl || '',
        isConfigured: Boolean(stored.encryptedApiKey),
        isEnabled: stored.isEnabled,
        supportedCapabilities: ['chat'],
        isBuiltIn: false,
      });
    }

    return { providers: providersList };
  });

  // PUT /api/admin/providers/:id
  fastify.put<{
    Params: { id: string };
    Body: {
      name?: string;
      adapterType?: string;
      apiKey?: string;
      baseUrl?: string;
      isEnabled?: boolean;
      extraHeaders?: Record<string, string>;
      customOptions?: Record<string, unknown>;
    };
  }>('/api/admin/providers/:id', { preHandler: authenticateAdmin }, async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};

    if (!fastify.db) {
      return reply.status(503).send({ error: 'Database not connected.' });
    }

    const existingRows = await fastify.db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, id))
      .limit(1);

    const existing = existingRows[0];

    // Encrypt API key if a new one is provided
    let encryptedApiKey = existing?.encryptedApiKey || '';
    if (body.apiKey && body.apiKey.trim()) {
      encryptedApiKey = encryptSecret(body.apiKey.trim(), fastify.appConfig.masterSecret);
    }

    const adapter = fastify.providerRegistry.get(body.adapterType || id) || fastify.providerRegistry.getGenericAdapter();

    const providerPayload: InsertProviderRow = {
      id,
      name: body.name || existing?.name || adapter.name,
      adapterType: body.adapterType || existing?.adapterType || adapter.id,
      baseUrl: body.baseUrl !== undefined ? body.baseUrl : existing?.baseUrl || adapter.defaultBaseUrl,
      encryptedApiKey,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : existing ? existing.isEnabled : true,
      extraHeaders: body.extraHeaders || existing?.extraHeaders || null,
      customOptions: body.customOptions || existing?.customOptions || null,
      updatedAt: new Date(),
    };

    if (existing) {
      await fastify.db.update(providersTable).set(providerPayload).where(eq(providersTable.id, id));
    } else {
      await fastify.db.insert(providersTable).values(providerPayload);
    }

    // Refresh memory cache immediately
    await fastify.routingCache.hydrate();

    return { message: 'Provider updated successfully', provider: { id, isConfigured: Boolean(encryptedApiKey) } };
  });

  // POST /api/admin/providers/:id/sync-models
  fastify.post<{ Params: { id: string } }>(
    '/api/admin/providers/:id/sync-models',
    { preHandler: authenticateAdmin },
    async (request, reply) => {
      const { id } = request.params;

      if (!fastify.db) {
        return reply.status(503).send({ error: 'Database not connected.' });
      }

      const rows = await fastify.db.select().from(providersTable).where(eq(providersTable.id, id)).limit(1);
      if (rows.length === 0) {
        return reply.status(404).send({ error: 'Provider not found.' });
      }

      const providerRow = rows[0];
      const adapter =
        fastify.providerRegistry.get(providerRow.adapterType) ||
        fastify.providerRegistry.get(providerRow.id) ||
        fastify.providerRegistry.getGenericAdapter();

      // Resolve config with decrypted key
      const route = fastify.routingCache.resolveModel(`${id}/dummy`);
      let apiKey = route?.provider.apiKey || '';
      if (!apiKey && providerRow.encryptedApiKey) {
        const { decryptSecret } = await import('@ai-gateway/db');
        apiKey = decryptSecret(providerRow.encryptedApiKey, fastify.appConfig.masterSecret);
      }

      const config: ProviderConfig = {
        id: providerRow.id,
        name: providerRow.name,
        adapterType: providerRow.adapterType,
        baseUrl: providerRow.baseUrl || undefined,
        apiKey,
        extraHeaders: providerRow.extraHeaders || undefined,
        customOptions: providerRow.customOptions || undefined,
        isEnabled: providerRow.isEnabled,
      };

      try {
        const discovered = await adapter.listModels(config);

        // Upsert into modelsTable
        for (const model of discovered) {
          const slug = `${providerRow.id}/${model.id}`;
          const modelPayload: InsertModelRow = {
            slug,
            modelId: model.id,
            providerId: providerRow.id,
            displayName: model.displayName,
            capabilities: model.capabilities,
            contextWindow: model.contextWindow || null,
            isEnabled: true,
            updatedAt: new Date(),
          };

          const existingModel = await fastify.db
            .select()
            .from(modelsTable)
            .where(eq(modelsTable.slug, slug))
            .limit(1);

          if (existingModel.length > 0) {
            await fastify.db
              .update(modelsTable)
              .set({
                displayName: model.displayName,
                capabilities: model.capabilities,
                contextWindow: model.contextWindow || null,
                updatedAt: new Date(),
              })
              .where(eq(modelsTable.slug, slug));
          } else {
            await fastify.db.insert(modelsTable).values(modelPayload);
          }
        }

        // Refresh cache
        await fastify.routingCache.hydrate();

        return {
          message: `Successfully synced ${discovered.length} models for ${providerRow.name}.`,
          count: discovered.length,
          models: discovered,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to sync models';
        return reply.status(500).send({ error: message });
      }
    }
  );
};
