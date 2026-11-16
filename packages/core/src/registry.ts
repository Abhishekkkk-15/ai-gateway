import type { ProviderAdapter } from './adapter.js';
import { GenericOpenAIAdapter } from './adapters/generic-openai.js';

export class ProviderRegistry {
  private adapters = new Map<string, ProviderAdapter>();
  private genericAdapter = new GenericOpenAIAdapter();

  constructor() {
    this.register(this.genericAdapter);
  }

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): ProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  getGenericAdapter(): ProviderAdapter {
    return this.genericAdapter;
  }

  list(): ProviderAdapter[] {
    return Array.from(this.adapters.values());
  }
}
