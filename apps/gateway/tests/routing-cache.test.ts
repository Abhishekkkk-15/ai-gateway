import { describe, it, expect, beforeEach } from 'vitest';
import { RoutingCache } from '../src/cache/routing-cache.js';
import { ProviderRegistry, GenericOpenAIAdapter } from '@ai-gateway/core';
import type { DbClient } from '@ai-gateway/db';

describe('RoutingCache Unit & Resolution Tests', () => {
  const masterSecret = 'test-master-secret-at-least-32-chars-long!!';
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry(new GenericOpenAIAdapter());
  });

  it('resolves models by full slug, custom alias, modelId, and short name', async () => {
    // Mock DB that returns enabled provider and models
    const mockDb = {
      select: () => ({
        from: (table: { [key: string]: unknown }) => {
          // Identify table by inspecting its shape or mock structure
          return {
            where: () => Promise.resolve([]),
            then: (resolve: (val: unknown) => void) => {
              // Return all providers or models based on schema call
              const isProvider = 'adapterType' in table;
              if (isProvider) {
                resolve([
                  {
                    id: 'nvidia',
                    name: 'NVIDIA NIM',
                    adapterType: 'openai-compatible',
                    baseUrl: 'https://integrate.api.nvidia.com/v1',
                    encryptedApiKey: '',
                    isEnabled: true,
                    extraHeaders: null,
                    customOptions: null,
                  },
                ]);
              } else {
                resolve([
                  {
                    slug: 'nvidia/openai/gpt-oss-20b',
                    modelId: 'openai/gpt-oss-20b',
                    providerId: 'nvidia',
                    displayName: 'GPT OSS 20B',
                    capabilities: ['chat'],
                    contextWindow: 32768,
                    customAlias: 'gpt-oss',
                    isEnabled: true,
                  },
                ]);
              }
            },
          };
        },
      }),
    } as unknown as DbClient;

    const cache = new RoutingCache(mockDb, masterSecret, registry);
    await cache.hydrate();

    expect(cache.getLoadedModelsCount()).toBe(1);

    // 1. Full slug resolution
    const route1 = cache.resolveModel('nvidia/openai/gpt-oss-20b');
    expect(route1).not.toBeNull();
    expect(route1?.model.slug).toBe('nvidia/openai/gpt-oss-20b');
    expect(route1?.provider.id).toBe('nvidia');

    // 2. Custom alias resolution
    const route2 = cache.resolveModel('gpt-oss');
    expect(route2).not.toBeNull();
    expect(route2?.model.slug).toBe('nvidia/openai/gpt-oss-20b');

    // 3. Model ID resolution (without provider prefix)
    const route3 = cache.resolveModel('openai/gpt-oss-20b');
    expect(route3).not.toBeNull();
    expect(route3?.model.slug).toBe('nvidia/openai/gpt-oss-20b');

    // 4. Short name resolution (just "gpt-oss-20b")
    const route4 = cache.resolveModel('gpt-oss-20b');
    expect(route4).not.toBeNull();
    expect(route4?.model.slug).toBe('nvidia/openai/gpt-oss-20b');

    // 5. Case-insensitive slug match
    const route5 = cache.resolveModel('NVIDIA/OPENAI/GPT-OSS-20B');
    expect(route5).not.toBeNull();
    expect(route5?.model.slug).toBe('nvidia/openai/gpt-oss-20b');
  });

  it('excludes models from disabled providers and provides actionable error explanation', async () => {
    const mockDb = {
      select: () => ({
        from: (table: { [key: string]: unknown }) => {
          return {
            where: () => Promise.resolve([]),
            then: (resolve: (val: unknown) => void) => {
              const isProvider = 'adapterType' in table;
              if (isProvider) {
                // Provider is disabled!
                resolve([
                  {
                    id: 'nvidia',
                    name: 'NVIDIA NIM',
                    adapterType: 'openai-compatible',
                    baseUrl: 'https://integrate.api.nvidia.com/v1',
                    encryptedApiKey: '',
                    isEnabled: false,
                    extraHeaders: null,
                    customOptions: null,
                  },
                ]);
              } else {
                resolve([
                  {
                    slug: 'nvidia/google/gemma-3-12b-it',
                    modelId: 'google/gemma-3-12b-it',
                    providerId: 'nvidia',
                    displayName: 'Gemma 3 12B IT',
                    capabilities: ['chat'],
                    contextWindow: 8192,
                    customAlias: null,
                    isEnabled: true,
                  },
                ]);
              }
            },
          };
        },
      }),
    } as unknown as DbClient;

    const cache = new RoutingCache(mockDb, masterSecret, registry);
    await cache.hydrate();

    // Provider is disabled, so models must NOT be routable
    expect(cache.getLoadedModelsCount()).toBe(0);
    expect(cache.resolveModel('nvidia/google/gemma-3-12b-it')).toBeNull();
    expect(cache.resolveModel('google/gemma-3-12b-it')).toBeNull();
    expect(cache.resolveModel('gemma-3-12b-it')).toBeNull();

    // Explain missing model should explicitly state that provider nvidia is disabled!
    const explanation = cache.explainMissingModel('nvidia/google/gemma-3-12b-it');
    expect(explanation).toContain("belongs to provider 'nvidia', which is currently disabled");
    expect(explanation).toContain("Enable provider 'nvidia' in Settings -> AI Providers");

    // Even if user queried by short name 'gemma-3-12b-it'
    const shortExplanation = cache.explainMissingModel('gemma-3-12b-it');
    expect(shortExplanation).toContain("belongs to provider 'nvidia', which is currently disabled");
  });

  it('excludes individually disabled models and explains that the model is disabled', async () => {
    const mockDb = {
      select: () => ({
        from: (table: { [key: string]: unknown }) => {
          return {
            where: () => Promise.resolve([]),
            then: (resolve: (val: unknown) => void) => {
              const isProvider = 'adapterType' in table;
              if (isProvider) {
                resolve([
                  {
                    id: 'groq',
                    name: 'Groq',
                    adapterType: 'openai-compatible',
                    baseUrl: 'https://api.groq.com/openai/v1',
                    encryptedApiKey: '',
                    isEnabled: true,
                    extraHeaders: null,
                    customOptions: null,
                  },
                ]);
              } else {
                resolve([
                  {
                    slug: 'groq/llama-3.1-8b-instant',
                    modelId: 'llama-3.1-8b-instant',
                    providerId: 'groq',
                    displayName: 'Llama 3.1 8B Instant',
                    capabilities: ['chat'],
                    contextWindow: 128000,
                    customAlias: null,
                    isEnabled: false, // Model disabled
                  },
                ]);
              }
            },
          };
        },
      }),
    } as unknown as DbClient;

    const cache = new RoutingCache(mockDb, masterSecret, registry);
    await cache.hydrate();

    expect(cache.getLoadedModelsCount()).toBe(0);
    expect(cache.resolveModel('groq/llama-3.1-8b-instant')).toBeNull();

    const explanation = cache.explainMissingModel('groq/llama-3.1-8b-instant');
    expect(explanation).toContain('is currently disabled in the gateway');
    expect(explanation).toContain('Enable it in the Models dashboard');
  });

  it('suggests available models when an unknown model is requested', async () => {
    const mockDb = {
      select: () => ({
        from: (table: { [key: string]: unknown }) => {
          return {
            where: () => Promise.resolve([]),
            then: (resolve: (val: unknown) => void) => {
              const isProvider = 'adapterType' in table;
              if (isProvider) {
                resolve([
                  {
                    id: 'groq',
                    name: 'Groq',
                    adapterType: 'openai-compatible',
                    baseUrl: 'https://api.groq.com/openai/v1',
                    encryptedApiKey: '',
                    isEnabled: true,
                    extraHeaders: null,
                    customOptions: null,
                  },
                ]);
              } else {
                resolve([
                  {
                    slug: 'groq/llama-3.3-70b-versatile',
                    modelId: 'llama-3.3-70b-versatile',
                    providerId: 'groq',
                    displayName: 'Llama 3.3 70B',
                    capabilities: ['chat'],
                    contextWindow: 128000,
                    customAlias: null,
                    isEnabled: true,
                  },
                ]);
              }
            },
          };
        },
      }),
    } as unknown as DbClient;

    const cache = new RoutingCache(mockDb, masterSecret, registry);
    await cache.hydrate();

    const explanation = cache.explainMissingModel('completely-random-model-xyz');
    expect(explanation).toContain("The model 'completely-random-model-xyz' does not exist or is not enabled");
    expect(explanation).toContain('Available active models include: groq/llama-3.3-70b-versatile');
    expect(explanation).toContain('GET /v1/models');
  });
});
