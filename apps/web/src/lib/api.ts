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
  async getProviders() {
    return fetchJson<{ providers: ProviderView[] }>(`${API_BASE}/api/admin/providers`);
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

  async deleteGatewayKey(id: string) {
    return fetchJson<{ message: string }>(`${API_BASE}/api/admin/gateway-keys/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // Logs
  async getLogs(limit = 100) {
    return fetchJson<{ logs: RequestLogView[] }>(`${API_BASE}/api/admin/logs?limit=${limit}`);
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
};
