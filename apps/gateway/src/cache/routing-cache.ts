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

export class RoutingCache {
  private db: DbClient | null = null;
  private masterSecret: string;
  private registry: ProviderRegistry;

  private providersMap = new Map<string, ProviderConfig>();
  private modelsMap = new Map<string, ResolvedRoute>();
  private aliasesMap = new Map<string, string>(); // alias -> slug
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
      // 1. Fetch and decrypt all enabled providers
      const providerRows = await this.db
        .select()
        .from(providersTable)
        .where(eq(providersTable.isEnabled, true));

      const freshProviders = new Map<string, ProviderConfig>();
      for (const row of providerRows) {
        let decryptedKey = '';
        try {
          decryptedKey = decryptSecret(row.encryptedApiKey, this.masterSecret);
        } catch (err) {
          console.error(`[RoutingCache] Failed to decrypt key for provider ${row.id}:`, err);
        }

        freshProviders.set(row.id, {
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

      // 2. Fetch all enabled models
      const modelRows = await this.db
        .select()
        .from(modelsTable)
        .where(eq(modelsTable.isEnabled, true));

      const freshModels = new Map<string, ResolvedRoute>();
      const freshAliases = new Map<string, string>();

      for (const row of modelRows) {
        const providerConfig = freshProviders.get(row.providerId);
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

        freshModels.set(row.slug, {
          model,
          provider: providerConfig,
          adapter,
        });

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
      this.providersMap = freshProviders;
      this.modelsMap = freshModels;
      this.aliasesMap = freshAliases;
      this.gatewayKeysMap = freshKeys;

      console.log(
        `[RoutingCache] Hydrated in-memory cache: ${freshProviders.size} providers, ${freshModels.size} models, ${freshAliases.size} aliases, ${freshKeys.size} gateway keys`
      );
    } catch (err) {
      console.error('[RoutingCache] Hydration error:', err);
    }
  }

  getProvider(id: string): ProviderConfig | undefined {
    return this.providersMap.get(id);
  }

  resolveModel(slugOrAlias: string): ResolvedRoute | null {
    const key = slugOrAlias.trim();
    // Direct slug match
    if (this.modelsMap.has(key)) {
      return this.modelsMap.get(key)!;
    }

    // Alias lookup
    const targetSlug = this.aliasesMap.get(key.toLowerCase());
    if (targetSlug && this.modelsMap.has(targetSlug)) {
      return this.modelsMap.get(targetSlug)!;
    }

    return null;
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
  }

  setAliasForTesting(alias: string, slug: string): void {
    this.aliasesMap.set(alias.toLowerCase(), slug);
  }
}
