import type {
  ProviderAdapter,
  ProviderConfig,
  UnifiedModel,
  ModelCapability,
  OpenAIChatCompletionRequest,
  OpenAIEmbeddingRequest,
} from '@ai-gateway/core';

export class GoogleAdapter implements ProviderAdapter {
  public readonly id = 'google';
  public readonly name = 'Google AI Studio';
  public readonly defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
  public readonly supportedCapabilities: ModelCapability[] = ['chat', 'vision', 'tools', 'embeddings'];

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
      // First attempt standard OpenAI /models on the OpenAI-compatible endpoint
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers,
        signal,
      });

      if (response.ok) {
        const data = (await response.json()) as {
          data?: Array<{ id: string; display_name?: string }>;
          models?: Array<{ name: string; displayName?: string; inputTokenLimit?: number }>;
        };

        if (Array.isArray(data.data) && data.data.length > 0) {
          return data.data.map((item) => {
            const normalizedId = item.id.replace(/^models\//, '');
            const isEmbed = normalizedId.toLowerCase().includes('embed');
            const capabilities: ModelCapability[] = isEmbed
              ? ['embeddings']
              : ['chat', 'vision', 'tools'];
            return {
              id: normalizedId,
              providerId: config.id,
              displayName: item.display_name || normalizedId,
              capabilities,
            };
          });
        }

        if (Array.isArray(data.models) && data.models.length > 0) {
          return data.models.map((item) => {
            const normalizedId = item.name.replace(/^models\//, '');
            const isEmbed = normalizedId.toLowerCase().includes('embed');
            const capabilities: ModelCapability[] = isEmbed
              ? ['embeddings']
              : ['chat', 'vision', 'tools'];
            return {
              id: normalizedId,
              providerId: config.id,
              displayName: item.displayName || normalizedId,
              capabilities,
              contextWindow: item.inputTokenLimit,
            };
          });
        }
      }

      return this.getCuratedDefaults(config.id);
    } catch {
      return this.getCuratedDefaults(config.id);
    }
  }

  private getCuratedDefaults(providerId: string): Omit<UnifiedModel, 'slug' | 'isEnabled'>[] {
    return [
      {
        id: 'gemini-2.5-flash',
        providerId,
        displayName: 'Gemini 2.5 Flash',
        capabilities: ['chat', 'vision', 'tools'],
        contextWindow: 1048576,
      },
      {
        id: 'gemini-2.5-pro',
        providerId,
        displayName: 'Gemini 2.5 Pro',
        capabilities: ['chat', 'vision', 'tools'],
        contextWindow: 2097152,
      },
      {
        id: 'gemini-2.0-flash',
        providerId,
        displayName: 'Gemini 2.0 Flash',
        capabilities: ['chat', 'vision', 'tools'],
        contextWindow: 1048576,
      },
      {
        id: 'gemini-1.5-flash',
        providerId,
        displayName: 'Gemini 1.5 Flash',
        capabilities: ['chat', 'vision', 'tools'],
        contextWindow: 1048576,
      },
      {
        id: 'gemini-1.5-pro',
        providerId,
        displayName: 'Gemini 1.5 Pro',
        capabilities: ['chat', 'vision', 'tools'],
        contextWindow: 2097152,
      },
      {
        id: 'text-embedding-004',
        providerId,
        displayName: 'Text Embedding 004',
        capabilities: ['embeddings'],
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

    // Normalize model parameter in case client passed models/ prefix
    const normalizedRequest = {
      ...request,
      model: request.model.replace(/^models\//, ''),
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(normalizedRequest),
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

    const normalizedRequest = {
      ...request,
      model: request.model.replace(/^models\//, ''),
    };

    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(normalizedRequest),
      signal,
      duplex: 'half',
    } as RequestInit);

    return response;
  }
}
