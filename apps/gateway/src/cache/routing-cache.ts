import type {
  ProviderConfig,
  UnifiedModel,
  GatewayKeyMetadata,
  ProviderAdapter,
} from '@ai-gateway/core';
import { ProviderRegistry } from '@ai-gateway/core';
import type { DbClient } from '@ai-gateway/db';
import {
  providersTable,
  modelsTable,
  gatewayKeysTable,
  decryptSecret,
  hashGatewayKey,
  eq,
} from '@ai-gateway/db';

export interface ResolvedRoute {
  model: UnifiedModel;
  provider: ProviderConfig;
  adapter: ProviderAdapter;
}

export interface KnownModelMeta {
  slug: string;
  modelId: string;
  providerId: string;
  isModelEnabled: boolean;
  isProviderEnabled: boolean;
}

export class RoutingCache {
  private db: DbClient | null = null;
  private masterSecret: string;
  private registry: ProviderRegistry;

  private providersMap = new Map<string, ProviderConfig>();
  private modelsMap = new Map<string, ResolvedRoute>();
  private aliasesMap = new Map<string, string>(); // alias -> slug
  private modelIdMap = new Map<string, string>(); // model.id -> slug
  private shortNameMap = new Map<string, string>(); // short name -> slug
  private knownModelsMap = new Map<string, KnownModelMeta>(); // slug -> status metadata
  private gatewayKeysMap = new Map<string, GatewayKeyMetadata>(); // SHA-256 hash -> metadata

  constructor(db: DbClient | null, masterSecret: string, registry: ProviderRegistry) {
    this.db = db;
    this.masterSecret = masterSecret;
    this.registry = registry;
  }

  setDb(db: DbClient | null): void {
    this.db = db;
  }

  async hydrate(): Promise<void> {
    if (!this.db) return;

    try {
      // 1. Fetch all providers from DB to know enabled vs disabled state
      const allDbProviders = await this.db.select().from(providersTable);
      const enabledProvidersMap = new Map<string, ProviderConfig>();
      const providerStatusMap = new Map<string, boolean>();

      for (const row of allDbProviders) {
        providerStatusMap.set(row.id, row.isEnabled);
        if (!row.isEnabled) continue;

        let decryptedKey = '';
        if (row.encryptedApiKey && row.encryptedApiKey.trim()) {
          try {
            decryptedKey = decryptSecret(row.encryptedApiKey, this.masterSecret);
          } catch (err) {
            console.error(`[RoutingCache] Failed to decrypt key for provider ${row.id}:`, err);
          }
        }

        enabledProvidersMap.set(row.id, {
          id: row.id,
          name: row.name,
          adapterType: row.adapterType,
          baseUrl: row.baseUrl || undefined,
          apiKey: decryptedKey,
          extraHeaders: row.extraHeaders || undefined,
          customOptions: row.customOptions || undefined,
          isEnabled: row.isEnabled,
        });
      }

      // 2. Fetch all models from DB
      const allDbModels = await this.db.select().from(modelsTable);

      const freshModels = new Map<string, ResolvedRoute>();
      const freshAliases = new Map<string, string>();
      const freshModelIds = new Map<string, string>();
      const freshShortNames = new Map<string, string>();
      const freshKnownModels = new Map<string, KnownModelMeta>();

      for (const row of allDbModels) {
        const isProviderEnabled = providerStatusMap.get(row.providerId) ?? false;
        freshKnownModels.set(row.slug, {
          slug: row.slug,
          modelId: row.modelId,
          providerId: row.providerId,
          isModelEnabled: row.isEnabled,
          isProviderEnabled,
        });

        // Only register into active routing cache if both provider and model are enabled
        if (!isProviderEnabled || !row.isEnabled) {
          continue;
        }

        const providerConfig = enabledProvidersMap.get(row.providerId);
        if (!providerConfig) continue;

        // Resolve adapter from registry (or fallback to generic adapter)
        const adapter =
          this.registry.get(providerConfig.adapterType) ||
          this.registry.get(row.providerId) ||
          this.registry.getGenericAdapter();

        const model: UnifiedModel = {
          id: row.modelId,
          providerId: row.providerId,
          slug: row.slug,
          displayName: row.displayName,
          capabilities: row.capabilities,
          contextWindow: row.contextWindow || undefined,
          isEnabled: row.isEnabled,
        };

        const resolvedRoute: ResolvedRoute = {
          model,
          provider: providerConfig,
          adapter,
        };

        freshModels.set(row.slug, resolvedRoute);

        // Map internal modelId (e.g. "openai/gpt-oss-20b" -> "nvidia/openai/gpt-oss-20b")
        const lowerModelId = row.modelId.toLowerCase();
        if (!freshModelIds.has(lowerModelId)) {
          freshModelIds.set(lowerModelId, row.slug);
        }

        // Map short name (e.g. "gpt-oss-20b" from "openai/gpt-oss-20b")
        const shortName = row.modelId.split('/').pop()?.toLowerCase();
        if (shortName && !freshShortNames.has(shortName)) {
          freshShortNames.set(shortName, row.slug);
        }

        if (row.customAlias) {
          freshAliases.set(row.customAlias.trim().toLowerCase(), row.slug);
        }
      }

      // 3. Fetch all active gateway keys
      const keyRows = await this.db
        .select()
        .from(gatewayKeysTable)
        .where(eq(gatewayKeysTable.isEnabled, true));

      const freshKeys = new Map<string, GatewayKeyMetadata>();
      for (const row of keyRows) {
        freshKeys.set(row.keyHash, {
          id: row.id,
          name: row.name,
          keyHash: row.keyHash,
          prefix: row.prefix,
          createdAt: row.createdAt,
          lastUsedAt: row.lastUsedAt,
          expiresAt: row.expiresAt,
          rateLimitRpm: row.rateLimitRpm,
          isEnabled: row.isEnabled,
        });
      }

      // Swap cache atomically in memory
      this.providersMap = enabledProvidersMap;
      this.modelsMap = freshModels;
      this.aliasesMap = freshAliases;
      this.modelIdMap = freshModelIds;
      this.shortNameMap = freshShortNames;
      this.knownModelsMap = freshKnownModels;
      this.gatewayKeysMap = freshKeys;

      console.log(
        `[RoutingCache] Hydrated in-memory cache: ${enabledProvidersMap.size} providers, ${freshModels.size} models, ${freshAliases.size} aliases, ${freshKeys.size} gateway keys`
      );
    } catch (err) {
      console.error('[RoutingCache] Hydration error:', err);
    }
  }

  getProvider(id: string): ProviderConfig | undefined {
    return this.providersMap.get(id);
  }

  resolveModel(slugOrAlias: string): ResolvedRoute | null {
    if (!slugOrAlias) return null;
    const key = slugOrAlias.trim();
    const lowerKey = key.toLowerCase();

    // 1. Direct slug match (e.g. "nvidia/openai/gpt-oss-20b")
    if (this.modelsMap.has(key)) {
      return this.modelsMap.get(key)!;
    }

    // 2. Custom alias lookup
    const aliasSlug = this.aliasesMap.get(lowerKey);
    if (aliasSlug && this.modelsMap.has(aliasSlug)) {
      return this.modelsMap.get(aliasSlug)!;
    }

    // 3. Model ID match (e.g. "openai/gpt-oss-20b" or "llama-3.3-70b-versatile")
    const modelIdSlug = this.modelIdMap.get(lowerKey);
    if (modelIdSlug && this.modelsMap.has(modelIdSlug)) {
      return this.modelsMap.get(modelIdSlug)!;
    }

    // 4. Short name match (e.g. "gpt-oss-20b")
    const shortSlug = this.shortNameMap.get(lowerKey);
    if (shortSlug && this.modelsMap.has(shortSlug)) {
      return this.modelsMap.get(shortSlug)!;
    }

    // 5. Case-insensitive slug fallback
    for (const [slug, route] of this.modelsMap) {
      if (slug.toLowerCase() === lowerKey) {
        return route;
      }
    }

    return null;
  }

  explainMissingModel(slugOrAlias: string): string {
    const raw = (slugOrAlias || '').trim();
    const lower = raw.toLowerCase();

    // Check if it matches a known disabled model or provider
    for (const info of this.knownModelsMap.values()) {
      const match =
        info.slug.toLowerCase() === lower ||
        info.modelId.toLowerCase() === lower ||
        info.modelId.toLowerCase().split('/').pop() === lower;

      if (match) {
        if (!info.isProviderEnabled) {
          return `The model '${raw}' belongs to provider '${info.providerId}', which is currently disabled. Enable provider '${info.providerId}' in Settings -> AI Providers.`;
        }
        if (!info.isModelEnabled) {
          return `The model '${raw}' is currently disabled in the gateway. Enable it in the Models dashboard.`;
        }
      }
    }

    const available = Array.from(this.modelsMap.keys()).slice(0, 5);
    const exampleList =
      available.length > 0 ? ` Available active models include: ${available.join(', ')}.` : '';
    return `The model '${raw}' does not exist or is not enabled in this gateway.${exampleList} Check GET /v1/models for full active catalog.`;
  }

  validateGatewayKey(rawKey: string): GatewayKeyMetadata | null {
    if (!rawKey) return null;
    const hash = hashGatewayKey(rawKey.trim());
    const metadata = this.gatewayKeysMap.get(hash);
    if (!metadata || !metadata.isEnabled) {
      return null;
    }

    if (metadata.expiresAt && metadata.expiresAt.getTime() < Date.now()) {
      return null;
    }

    return metadata;
  }

  listModels(): UnifiedModel[] {
    return Array.from(this.modelsMap.values()).map((r) => r.model);
  }

  listGatewayKeys(): GatewayKeyMetadata[] {
    return Array.from(this.gatewayKeysMap.values());
  }

  getLoadedModelsCount(): number {
    return this.modelsMap.size;
  }

  // Testing hooks
  setGatewayKeyForTesting(keyHash: string, metadata: GatewayKeyMetadata): void {
    this.gatewayKeysMap.set(keyHash, metadata);
  }

  setModelForTesting(slug: string, route: ResolvedRoute): void {
    this.modelsMap.set(slug, route);
    if (route.model?.id) {
      this.modelIdMap.set(route.model.id.toLowerCase(), slug);
      const short = route.model.id.split('/').pop()?.toLowerCase();
      if (short) {
        this.shortNameMap.set(short, slug);
      }
    }
  }

  setAliasForTesting(alias: string, slug: string): void {
    this.aliasesMap.set(alias.toLowerCase(), slug);
  }
}
