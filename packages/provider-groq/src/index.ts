import type {
  ProviderAdapter,
  ProviderConfig,
  UnifiedModel,
  ModelCapability,
  OpenAIChatCompletionRequest,
} from '@ai-gateway/core';

export class GroqAdapter implements ProviderAdapter {
  public readonly id = 'groq';
  public readonly name = 'Groq';
  public readonly defaultBaseUrl = 'https://api.groq.com/openai/v1';
  public readonly supportedCapabilities: ModelCapability[] = ['chat', 'stt', 'vision', 'tools'];

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
        data?: Array<{ id: string; context_window?: number }>;
      };

      if (!Array.isArray(data.data)) {
        return this.getCuratedDefaults(config.id);
      }

      return data.data.map((item) => {
        const isWhisper = item.id.toLowerCase().includes('whisper');
        const capabilities: ModelCapability[] = isWhisper
          ? ['stt']
          : ['chat', 'vision', 'tools'];

        return {
          id: item.id,
          providerId: config.id,
          displayName: item.id,
          capabilities,
          contextWindow: item.context_window,
        };
      });
    } catch {
      return this.getCuratedDefaults(config.id);
    }
  }

  private getCuratedDefaults(providerId: string): Omit<UnifiedModel, 'slug' | 'isEnabled'>[] {
    return [
      {
        id: 'llama-3.3-70b-versatile',
        providerId,
        displayName: 'Llama 3.3 70B Versatile',
        capabilities: ['chat', 'tools'],
        contextWindow: 131072,
      },
      {
        id: 'llama-3.1-8b-instant',
        providerId,
        displayName: 'Llama 3.1 8B Instant',
        capabilities: ['chat', 'tools'],
        contextWindow: 131072,
      },
      {
        id: 'whisper-large-v3-turbo',
        providerId,
        displayName: 'Whisper Large v3 Turbo',
        capabilities: ['stt'],
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

  async transcribeAudio(
    formData: FormData,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response> {
    const baseUrl = this.getBaseUrl(config);
    const headers: Record<string, string> = {
      ...config.extraHeaders,
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers,
      body: formData,
      signal,
      duplex: 'half',
    } as RequestInit);

    return response;
  }

  async translateAudio(
    formData: FormData,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response> {
    const baseUrl = this.getBaseUrl(config);
    const headers: Record<string, string> = {
      ...config.extraHeaders,
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(`${baseUrl}/audio/translations`, {
      method: 'POST',
      headers,
      body: formData,
      signal,
      duplex: 'half',
    } as RequestInit);

    return response;
  }
}
