import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry } from '../src/registry.js';
import type { ProviderAdapter, ProviderConfig, UnifiedModel } from '../src/types.js';

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  const dummyAdapter: ProviderAdapter = {
    id: 'mock-provider',
    name: 'Mock Provider',
    defaultBaseUrl: 'https://api.mock.com/v1',
    supportedCapabilities: ['chat'],
    async listModels(config: ProviderConfig): Promise<Omit<UnifiedModel, 'slug' | 'isEnabled'>[]> {
      return [
        {
          id: 'mock-model-1',
          providerId: config.id,
          displayName: 'Mock Model 1',
          capabilities: ['chat'],
        },
      ];
    },
  };

  it('registers and retrieves a provider adapter by id', () => {
    registry.register(dummyAdapter);
    expect(registry.get('mock-provider')).toBe(dummyAdapter);
  });

  it('returns undefined for an unregistered adapter id', () => {
    expect(registry.get('non-existent')).toBeUndefined();
  });

  it('lists all registered adapters', () => {
    registry.register(dummyAdapter);
    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.some((a) => a.id === 'mock-provider')).toBe(true);
    expect(list.some((a) => a.id === 'openai-compatible')).toBe(true);
  });

  it('returns generic adapter as fallback when adapter is not registered', () => {
    const generic = registry.getGenericAdapter();
    expect(generic).toBeDefined();
    expect(generic.id).toBe('openai-compatible');
  });
});
