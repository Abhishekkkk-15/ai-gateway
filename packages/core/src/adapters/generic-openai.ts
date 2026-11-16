import type { ProviderAdapter } from '../adapter.js';
import type {
  ModelCapability,
  ProviderConfig,
  UnifiedModel,
  OpenAIChatCompletionRequest,
  OpenAISpeechRequest,
  OpenAIEmbeddingRequest,
} from '../types.js';

export class GenericOpenAIAdapter implements ProviderAdapter {
  public readonly id = 'openai-compatible';
  public readonly name = 'OpenAI Compatible';
  public readonly defaultBaseUrl = 'https://api.openai.com/v1';
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

    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers,
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Failed to list models from ${config.name} (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as { data?: Array<{ id: string; name?: string }> };
    if (!Array.isArray(data.data)) {
      return [];
    }

    return data.data.map((item) => ({
      id: item.id,
      providerId: config.id,
      displayName: item.name || item.id,
      capabilities: ['chat'],
    }));
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

  async synthesizeSpeech(
    request: OpenAISpeechRequest,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response> {
    const baseUrl = this.getBaseUrl(config);
    const headers = this.getHeaders(config);

    const response = await fetch(`${baseUrl}/audio/speech`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal,
      duplex: 'half',
    } as RequestInit);

    return response;
  }
}
