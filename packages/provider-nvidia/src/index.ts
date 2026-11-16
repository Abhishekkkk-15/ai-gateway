import type {
  ProviderAdapter,
  ProviderConfig,
  UnifiedModel,
  ModelCapability,
  OpenAIChatCompletionRequest,
  OpenAIEmbeddingRequest,
} from '@ai-gateway/core';

export class NvidiaAdapter implements ProviderAdapter {
  public readonly id = 'nvidia';
  public readonly name = 'NVIDIA NIM';
  public readonly defaultBaseUrl = 'https://integrate.api.nvidia.com/v1';
  public readonly supportedCapabilities: ModelCapability[] = ['chat', 'embeddings', 'vision', 'tools'];

  private getBaseUrl(config: ProviderConfig): string {
    const raw = config.baseUrl?.trim() || this.defaultBaseUrl;
    return raw.replace(/\/+$/, '');
  }

  private getHeaders(config: ProviderConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.extraHeaders,
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
    return headers;
  }

  async listModels(
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Omit<UnifiedModel, 'slug' | 'isEnabled'>[]> {
    const baseUrl = this.getBaseUrl(config);
    const headers = this.getHeaders(config);

    try {
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers,
        signal,
      });

      if (!response.ok) {
        return this.getCuratedDefaults(config.id);
      }

      const data = (await response.json()) as {
        data?: Array<{ id: string; owned_by?: string }>;
      };

      if (!Array.isArray(data.data)) {
        return this.getCuratedDefaults(config.id);
      }

      return data.data.map((item) => {
        const isEmbed = item.id.toLowerCase().includes('embed');
        const capabilities: ModelCapability[] = isEmbed
          ? ['embeddings']
          : ['chat', 'tools'];
        return {
          id: item.id,
          providerId: config.id,
          displayName: item.id,
          capabilities,
        };
      });
    } catch {
      return this.getCuratedDefaults(config.id);
    }
  }

  private getCuratedDefaults(providerId: string): Omit<UnifiedModel, 'slug' | 'isEnabled'>[] {
    return [
      {
        id: 'meta/llama-3.1-405b-instruct',
        providerId,
        displayName: 'Meta Llama 3.1 405B Instruct',
        capabilities: ['chat', 'tools'],
        contextWindow: 128000,
      },
      {
        id: 'meta/llama-3.1-70b-instruct',
        providerId,
        displayName: 'Meta Llama 3.1 70B Instruct',
        capabilities: ['chat', 'tools'],
        contextWindow: 128000,
      },
      {
        id: 'mistralai/mixtral-8x22b-instruct-v0.1',
        providerId,
        displayName: 'Mixtral 8x22B Instruct',
        capabilities: ['chat', 'tools'],
        contextWindow: 65536,
      },
    ];
  }

  async chatCompletions(
    request: OpenAIChatCompletionRequest,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response> {
    const baseUrl = this.getBaseUrl(config);
    const headers = this.getHeaders(config);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal,
      duplex: 'half',
    } as RequestInit);

    return response;
  }

  async createEmbeddings(
    request: OpenAIEmbeddingRequest,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response> {
    const baseUrl = this.getBaseUrl(config);
    const headers = this.getHeaders(config);

    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal,
      duplex: 'half',
    } as RequestInit);

    return response;
  }
}
