import type { ProviderAdapter } from '../adapter.js';
import type {
  ModelCapability,
  ProviderConfig,
  UnifiedModel,
  OpenAIChatCompletionRequest,
  OpenAISpeechRequest,
  OpenAIEmbeddingRequest,
  OpenAIImageGenerateRequest,
  OpenAIModerationRequest,
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

    // Cloudflare Workers AI rejects GET …/ai/v1/models (405). Use the native catalog.
    if (isCloudflareWorkersAiConfig(config, baseUrl)) {
      const cloudflareAccountId = extractCloudflareAccountId(baseUrl);
      if (!cloudflareAccountId) {
        throw new Error(
          'Cloudflare Workers AI base URL must include your Account ID (replace {account_id}). Example: https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/v1'
        );
      }
      return this.listCloudflareWorkersAiModels(cloudflareAccountId, config, headers, signal);
    }

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

  private async listCloudflareWorkersAiModels(
    accountId: string,
    config: ProviderConfig,
    headers: Record<string, string>,
    signal?: AbortSignal
  ): Promise<Omit<UnifiedModel, 'slug' | 'isEnabled'>[]> {
    const catalogUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`;
    const response = await fetch(catalogUrl, {
      method: 'GET',
      headers,
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Cloudflare authentication failed (${response.status}). Use a Cloudflare API Token with Account → Workers AI → Read (not your Account ID, and not a Global API Key). Create one from Workers AI → Use REST API → Create a Workers AI API Token, paste it as the provider API key, Save, then Sync again. Upstream: ${errText}`
        );
      }
      throw new Error(`Failed to list models from ${config.name} (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as {
      result?: Array<{ name?: string; id?: string; task?: { name?: string } | string }>;
    };

    if (!Array.isArray(data.result)) {
      return [];
    }

    return data.result
      .map((item) => {
        const id = item.name || item.id;
        if (!id) return null;

        const taskName =
          typeof item.task === 'string' ? item.task : item.task?.name || '';
        const capabilities = cloudflareTaskToCapabilities(taskName);
        if (!capabilities) return null;

        return {
          id,
          providerId: config.id,
          displayName: id,
          capabilities,
        };
      })
      .filter((model): model is Omit<UnifiedModel, 'slug' | 'isEnabled'> => model !== null);
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

  async generateImages(
    request: OpenAIImageGenerateRequest,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response> {
    const baseUrl = this.getBaseUrl(config);
    const headers = this.getHeaders(config);

    const response = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal,
      duplex: 'half',
    } as RequestInit);

    return response;
  }

  async editImages(
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

    const response = await fetch(`${baseUrl}/images/edits`, {
      method: 'POST',
      headers,
      body: formData,
      signal,
      duplex: 'half',
    } as RequestInit);

    return response;
  }

  async createImageVariations(
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

    const response = await fetch(`${baseUrl}/images/variations`, {
      method: 'POST',
      headers,
      body: formData,
      signal,
      duplex: 'half',
    } as RequestInit);

    return response;
  }

  async createModeration(
    request: OpenAIModerationRequest,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response> {
    const baseUrl = this.getBaseUrl(config);
    const headers = this.getHeaders(config);

    const response = await fetch(`${baseUrl}/moderations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal,
      duplex: 'half',
    } as RequestInit);

    return response;
  }
}

/** True when this provider should use Cloudflare's native model catalog. */
export function isCloudflareWorkersAiConfig(config: ProviderConfig, baseUrl: string): boolean {
  if (config.id === 'cloudflare' || config.adapterType === 'cloudflare') return true;
  return /api\.cloudflare\.com\/client\/v4\/accounts\//i.test(baseUrl);
}

/** Extract Cloudflare account id from …/accounts/{id}/ai… base URLs. */
export function extractCloudflareAccountId(baseUrl: string): string | null {
  const match = baseUrl.match(
    /api\.cloudflare\.com\/client\/v4\/accounts\/([^/?#]+)(?:\/ai)?/i
  );
  const accountId = match?.[1]?.trim();
  if (!accountId || accountId === '{account_id}' || accountId.toLowerCase() === 'your_account_id') {
    return null;
  }
  return accountId;
}

function cloudflareTaskToCapabilities(taskName: string): ModelCapability[] | null {
  const task = taskName.toLowerCase();
  if (task.includes('embed')) return ['embeddings'];
  if (
    task.includes('text generation') ||
    task.includes('text-generation') ||
    task.includes('summarization') ||
    task.includes('translation') ||
    task === 'chat'
  ) {
    return ['chat'];
  }
  // Skip image/audio/etc. for the curated OpenAI chat/embeddings catalog path.
  return null;
}
