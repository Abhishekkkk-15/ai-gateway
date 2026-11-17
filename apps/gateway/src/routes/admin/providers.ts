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
import {
  OPENAI_COMPATIBLE_PRESETS,
  getOpenAICompatiblePreset,
  type ProviderConfig,
} from '@ai-gateway/core';

export const adminProvidersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/admin/providers
  fastify.get('/api/admin/providers', { preHandler: authenticateAdmin }, async () => {
    // Registered adapters from code (non-OpenAI-compatible dedicated adapters)
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
    const providersList = [];
    const seenIds = new Set<string>();

    // OpenAI-compatible presets (Groq, NVIDIA, etc.) — same path as custom providers
    for (const preset of OPENAI_COMPATIBLE_PRESETS) {
      const stored = dbProvidersMap.get(preset.id);
      providersList.push({
        id: preset.id,
        name: stored?.name || preset.name,
        adapterType: 'openai-compatible',
        defaultBaseUrl: preset.defaultBaseUrl,
        baseUrl: stored?.baseUrl || preset.defaultBaseUrl,
        isConfigured: Boolean(stored?.encryptedApiKey),
        isEnabled: stored ? stored.isEnabled : false,
        supportedCapabilities: preset.supportedCapabilities,
        isBuiltIn: true,
        isPreset: true,
      });
      seenIds.add(preset.id);
      dbProvidersMap.delete(preset.id);
    }

    // Dedicated adapters (e.g. google, elevenlabs) — skip generic openai-compatible registry entry
    for (const adapter of registeredAdapters) {
      if (adapter.id === 'openai-compatible' || seenIds.has(adapter.id)) continue;
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
        isPreset: false,
      });
      seenIds.add(adapter.id);
      dbProvidersMap.delete(adapter.id);
    }

    // Remaining custom OpenAI-compatible providers from DB
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
        isPreset: false,
      });
    }

    return { providers: providersList, presets: OPENAI_COMPATIBLE_PRESETS };
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

    const preset = getOpenAICompatiblePreset(id);
    const adapter =
      fastify.providerRegistry.get(body.adapterType || id) ||
      fastify.providerRegistry.getGenericAdapter();

    let isEnabled = true;
    if (body.isEnabled !== undefined) {
      isEnabled = body.isEnabled;
    } else if (existing) {
      if (body.apiKey && body.apiKey.trim()) {
        isEnabled = true;
      } else {
        isEnabled = existing.isEnabled;
      }
    }

    const resolvedAdapterType =
      body.adapterType ||
      existing?.adapterType ||
      (preset ? 'openai-compatible' : adapter.id);

    const providerPayload: InsertProviderRow = {
      id,
      name: body.name || existing?.name || preset?.name || adapter.name,
      adapterType: resolvedAdapterType,
      baseUrl:
        body.baseUrl !== undefined
          ? body.baseUrl
          : existing?.baseUrl || preset?.defaultBaseUrl || adapter.defaultBaseUrl,
      encryptedApiKey,
      isEnabled,
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
        return reply.status(400).send({
          error: `Provider '${id}' is not saved yet. Please enter your API key and click "Save Changes" first.`,
        });
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

      if (!config.apiKey?.trim()) {
        return reply.status(400).send({
          error:
            `No API key is stored for provider '${id}'. Paste the provider API key into the field, click Save Changes, then Sync Models. (The dots placeholder does not mean a key is loaded into the input.)`,
        });
      }

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

        // Ensure provider is enabled if it has an API key so synced models are immediately routable
        if (!providerRow.isEnabled && providerRow.encryptedApiKey) {
          await fastify.db
            .update(providersTable)
            .set({ isEnabled: true, updatedAt: new Date() })
            .where(eq(providersTable.id, id));
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

  // GET /api/admin/providers/elevenlabs/voices
  fastify.get(
    '/api/admin/providers/elevenlabs/voices',
    { preHandler: authenticateAdmin },
    async (request, reply) => {
      let apiKey = '';

      if (fastify.db) {
        const rows = await fastify.db
          .select()
          .from(providersTable)
          .where(eq(providersTable.id, 'elevenlabs'))
          .limit(1);

        if (rows.length > 0 && rows[0].encryptedApiKey) {
          const { decryptSecret } = await import('@ai-gateway/db');
          apiKey = decryptSecret(rows[0].encryptedApiKey, fastify.appConfig.masterSecret);
        }
      }

      if (!apiKey) {
        return {
          source: 'default',
          voices: DEFAULT_ELEVENLABS_VOICES,
        };
      }

      try {
        const upstreamRes = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: {
            'xi-api-key': apiKey,
          },
        });

        if (!upstreamRes.ok) {
          return {
            source: 'default_fallback',
            voices: DEFAULT_ELEVENLABS_VOICES,
          };
        }

        const data = (await upstreamRes.json()) as {
          voices: Array<{
            voice_id: string;
            name: string;
            category: string;
            labels?: Record<string, string>;
            description?: string;
          }>;
        };

        const voices = (data.voices || []).map((v) => ({
          id: v.voice_id,
          name: v.name,
          category: v.category || 'premade',
          isFreeSupported: v.category !== 'library',
          description:
            v.description ||
            (v.labels
              ? Object.entries(v.labels)
                  .map(([k, val]) => `${k}: ${val}`)
                  .join(', ')
              : v.category),
        }));

        return {
          source: 'live',
          voices,
        };
      } catch (err: unknown) {
        return {
          source: 'default_fallback',
          voices: DEFAULT_ELEVENLABS_VOICES,
        };
      }
    }
  );
};

const DEFAULT_ELEVENLABS_VOICES = [
  {
    id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    category: 'premade',
    isFreeSupported: true,
    description: 'Warm, British, captivating storyteller (Default Free)',
  },
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    category: 'premade',
    isFreeSupported: true,
    description: 'Calm, professional, warm (Default Free)',
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah',
    category: 'premade',
    isFreeSupported: true,
    description: 'Soft, gentle, friendly (Default Free)',
  },
  {
    id: 'CwhRBWXzGAHq8TQ4Fs17',
    name: 'Roger',
    category: 'premade',
    isFreeSupported: true,
    description: 'Calm, steady, confident (Default Free)',
  },
  {
    id: 'TX3LPaxmHKxFdv7VOQHJ',
    name: 'Liam',
    category: 'premade',
    isFreeSupported: true,
    description: 'Young, natural, conversational (Default Free)',
  },
  {
    id: 'Xb7hH8MSUJpSbSDYk0k2',
    name: 'Alice',
    category: 'premade',
    isFreeSupported: true,
    description: 'Clear, confident, expressive (Default Free)',
  },
  {
    id: 'SAz9YHcvj6GT2YYXdXww',
    name: 'River',
    category: 'premade',
    isFreeSupported: true,
    description: 'Confident, neutral, relaxed (Default Free)',
  },
  {
    id: 'FGY2WhTYpPnrIDTdsKH5',
    name: 'Laura',
    category: 'premade',
    isFreeSupported: true,
    description: 'Enthusiastic, bright, warm (Default Free)',
  },
  {
    id: 'IKne3meq5aSn9XLyUdCD',
    name: 'Charlie',
    category: 'premade',
    isFreeSupported: true,
    description: 'Australian, casual, deep (Default Free)',
  },
  {
    id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    category: 'premade',
    isFreeSupported: true,
    description: 'Deep, authoritative, news (Default Free)',
  },
  {
    id: 'pFZP5JQG7iQjIQuC4Bku',
    name: 'Lily',
    category: 'premade',
    isFreeSupported: true,
    description: 'Velvety, warm narrator (Default Free)',
  },
  {
    id: 'pqHfZKP75CvOlQylNhV4',
    name: 'Bill',
    category: 'premade',
    isFreeSupported: true,
    description: 'Trustworthy, documentary (Default Free)',
  },
  {
    id: 'nPczCjzI2devNBz1zQrb',
    name: 'Brian',
    category: 'premade',
    isFreeSupported: true,
    description: 'Deep, dynamic, professional (Default Free)',
  },
];
