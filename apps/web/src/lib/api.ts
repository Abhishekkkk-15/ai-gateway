export interface ProviderView {
  id: string;
  name: string;
  adapterType: string;
  defaultBaseUrl: string;
  baseUrl: string;
  isConfigured: boolean;
  isEnabled: boolean;
  supportedCapabilities: string[];
  isBuiltIn: boolean;
  isPreset?: boolean;
}

export interface ModelView {
  slug: string;
  modelId: string;
  providerId: string;
  displayName: string;
  capabilities: string[];
  contextWindow?: number;
  customAlias?: string | null;
  isEnabled: boolean;
}

export interface GatewayKeyView {
  id: string;
  name: string;
  prefix: string;
  rateLimitRpm?: number | null;
  isEnabled: boolean;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

export interface RequestLogView {
  id: string;
  timestamp: string;
  modelSlug: string;
  providerId: string;
  gatewayKeyId?: string | null;
  statusCode: number;
  isStreaming: boolean;
  ttftMs?: number | null;
  latencyMs: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
  errorMessage?: string | null;
}

export interface ImageGenerationPayload {
  model?: string;
  prompt: string;
  n?: number;
  size?: string;
  quality?: string;
  style?: string;
  response_format?: 'url' | 'b64_json';
}

export interface ImageGenerationResponse {
  created?: number;
  data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
  images?: Array<{ url?: string; b64_json?: string }>;
  result?: { image?: string } | string;
}

export interface ImageAnalysisResult {
  content: string;
  model?: string;
  latencyMs: number;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface ChatCompletionLike {
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{ message?: { content?: unknown } }>;
  output_text?: string;
}

function extractAssistantText(payload: ChatCompletionLike): string {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('')
      .trim();
  }

  return typeof payload.output_text === 'string' ? payload.output_text.trim() : '';
}

const API_BASE = '';

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let errMessage = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      errMessage = err.error?.message || err.error || errMessage;
    } catch {
      // not json
    }
    throw new Error(errMessage);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  async login(username: string, password: string) {
    return fetchJson<{ message: string; user: { username: string }; token?: string }>(
      `${API_BASE}/api/admin/login`,
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }
    );
  },

  async logout() {
    return fetchJson<{ message: string }>(`${API_BASE}/api/admin/logout`, {
      method: 'POST',
    });
  },

  async getMe() {
    return fetchJson<{ user: { username: string; role: string } }>(`${API_BASE}/api/admin/me`);
  },

  // Providers
  async getProviders(params?: { configuredOnly?: boolean }) {
    const query = params?.configuredOnly ? '?configuredOnly=true' : '';
    return fetchJson<{ providers: ProviderView[] }>(`${API_BASE}/api/admin/providers${query}`);
  },

  async updateProvider(
    id: string,
    data: {
      name?: string;
      adapterType?: string;
      apiKey?: string;
      baseUrl?: string;
      isEnabled?: boolean;
    }
  ) {
    return fetchJson<{ message: string }>(`${API_BASE}/api/admin/providers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async syncProviderModels(id: string) {
    return fetchJson<{ message: string; count: number; models: unknown[] }>(
      `${API_BASE}/api/admin/providers/${encodeURIComponent(id)}/sync-models`,
      { method: 'POST' }
    );
  },

  // Models
  async getModels() {
    return fetchJson<{ models: ModelView[] }>(`${API_BASE}/api/admin/models`);
  },

  async createModel(data: {
    providerId: string;
    modelId: string;
    displayName?: string;
    capabilities?: string[];
    contextWindow?: number | null;
    customAlias?: string | null;
    isEnabled?: boolean;
  }) {
    return fetchJson<{ message: string; model: ModelView }>(`${API_BASE}/api/admin/models`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateModel(slug: string, data: { customAlias?: string | null; isEnabled?: boolean }) {
    return fetchJson<{ message: string }>(`${API_BASE}/api/admin/models/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Gateway Keys
  async getGatewayKeys() {
    return fetchJson<{ keys: GatewayKeyView[] }>(`${API_BASE}/api/admin/gateway-keys`);
  },

  async createGatewayKey(data: { name: string; rateLimitRpm?: number; expiresInDays?: number }) {
    return fetchJson<{ id: string; name: string; prefix: string; apiKey: string; message: string }>(
      `${API_BASE}/api/admin/gateway-keys`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  async updateGatewayKey(id: string, data: { isEnabled?: boolean; name?: string }) {
    return fetchJson<{ message: string }>(`${API_BASE}/api/admin/gateway-keys/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteGatewayKey(id: string) {
    return fetchJson<{ message: string }>(`${API_BASE}/api/admin/gateway-keys/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // Logs
  async getLogs(limit = 50, offset = 0) {
    return fetchJson<{ logs: RequestLogView[]; total?: number; limit?: number; offset?: number }>(
      `${API_BASE}/api/admin/logs?limit=${limit}&offset=${offset}`
    );
  },

  // ElevenLabs Live Voices
  async getElevenLabsVoices() {
    return fetchJson<{
      source: string;
      voices: Array<{
        id: string;
        name: string;
        category: string;
        isFreeSupported: boolean;
        description: string;
      }>;
    }>(`${API_BASE}/api/admin/providers/elevenlabs/voices`);
  },

  // Test Chat Stream
  async chatStream(
    apiKey: string,
    model: string,
    prompt: string,
    onChunk: (chunk: string) => void,
    onTtft?: (ms: number) => void
  ): Promise<{ totalTimeMs: number }> {
    const startTime = performance.now();
    let hasReceivedFirstChunk = false;

    const res = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No readable stream available.');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (!hasReceivedFirstChunk) {
        hasReceivedFirstChunk = true;
        const ttft = Math.round(performance.now() - startTime);
        if (onTtft) onTtft(ttft);
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;
            const content = delta?.content ?? delta?.reasoning ?? delta?.reasoning_content;
            if (content) onChunk(content);
          } catch {
            // ignore non-json chunk
          }
        }
      }
    }

    return { totalTimeMs: Math.round(performance.now() - startTime) };
  },

  // Image generation
  async generateImage(apiKey: string, payload: ImageGenerationPayload) {
    const startedAt = performance.now();
    const data = await fetchJson<ImageGenerationResponse>(
      `${API_BASE}/v1/images/generations`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      }
    );

    return { ...data, latencyMs: Math.round(performance.now() - startedAt) };
  },

  // Vision / image analysis through chat completions
  async analyzeImage(
    apiKey: string,
    params: {
      model: string;
      prompt: string;
      imageUrl: string;
      detail?: 'auto' | 'low' | 'high';
    }
  ): Promise<ImageAnalysisResult> {
    const startedAt = performance.now();
    const data = await fetchJson<ChatCompletionLike>(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: params.model,
        stream: false,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: params.prompt },
              {
                type: 'image_url',
                image_url: { url: params.imageUrl, detail: params.detail ?? 'auto' },
              },
            ],
          },
        ],
      }),
    });

    return {
      content: extractAssistantText(data),
      model: data.model,
      usage: data.usage,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  },
};
