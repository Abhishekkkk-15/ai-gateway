# ⚡ OpenAI-Compatible Self-Hosted AI Gateway

A production-ready, ultra-low-latency, self-hosted AI Gateway that unifies multiple LLM, Speech-to-Text (STT), and Text-to-Speech (TTS) providers behind a single **OpenAI SDK-compatible API** (`baseURL` + single gateway API key), paired with a single-admin React 19 web console for provider, model, and key management.

Built for **Render** (ephemeral container filesystem) with persistent state in **Neon Serverless Postgres** and **zero-DB latency hot-path routing** via an in-memory synchronized cache.

---

## 🌟 Key Features

- **Standard OpenAI SDK Compatibility**: Drop-in replacement for OpenAI SDK clients (`openai.chat.completions.create`, `openai.audio.speech.create`, `openai.audio.transcriptions.create`, `openai.models.list`).
- **Zero-DB Latency on Hot Path**: The `/v1/*` proxy pipeline resolves keys, models, and provider routes strictly from an in-memory `Map` cache (<0.1ms overhead). Postgres is never queried on the hot path.
- **Render Ephemeral Recovery**: On container startup, the gateway immediately hydrates its in-memory routing cache from Neon Serverless Postgres.
- **Zero-Buffering Streaming**: Undici `ReadableStream` / SSE chunks pipe directly to client HTTP responses with native `AbortSignal` cancellation upon client disconnect.
- **Dynamic OpenAI-Compatible Providers**: Connect **any** OpenAI-compatible provider (DeepSeek, Together AI, Mistral, Ollama, Perplexity, vLLM, self-hosted LLMs) instantly through the Web UI without writing or deploying new packages.
- **Curated Dedicated Adapters**:
  - **Groq**: High-throughput Chat Completions (SSE/JSON) + Whisper STT.
  - **NVIDIA NIM**: NVIDIA NIM Chat Completions (SSE/JSON).
  - **Google Gemini**: OpenAI-compatible endpoint with model normalization (`gemini-2.5-flash`, etc.).
  - **ElevenLabs**: Expressive streaming Text-to-Speech (`/v1/audio/speech`) and Scribe STT (`/v1/audio/transcriptions`).
- **Non-Blocking Telemetry**: Request metrics (TTFT, latency, status code, model, token usage) are buffered and persisted asynchronously without delaying client responses.
- **Robust Security**: Upstream provider API keys encrypted at rest with **AES-256-GCM** derived from `MASTER_SECRET`. Gateway API keys hashed with **SHA-256**. Single admin authenticated via signed HttpOnly JWT cookies.
- **Single-Admin Dashboard**: React 19 + Vite + Tailwind CSS + shadcn/ui console for managing providers, model aliases, gateway keys, code snippets, and live playground testing.

---

## 🏗️ Monorepo Architecture

Orchestrated with **pnpm workspaces** and **Turborepo**:

```text
ai-gateway/
├── apps/
│   ├── gateway/                  # Fastify low-latency API server (Render-ready)
│   └── web/                      # React 19 + Vite + shadcn/ui admin console
├── packages/
│   ├── core/                     # ProviderAdapter interface, GenericOpenAIAdapter, ProviderRegistry, types
│   ├── db/                       # Neon Serverless Postgres + Drizzle ORM + AES-256-GCM crypto helpers
│   ├── provider-groq/            # Groq adapter (Chat + Whisper STT)
│   ├── provider-nvidia/          # NVIDIA NIM adapter (Chat)
│   ├── provider-google/          # Google Gemini adapter (Chat + model normalization)
│   ├── provider-elevenlabs/      # ElevenLabs adapter (TTS stream + Scribe STT)
│   └── tsconfig/                 # Shared TypeScript configurations
├── render.yaml                   # Render 1-click Blueprint
├── Dockerfile                    # Multi-stage container build
└── .env.example
```

---

## 🚀 Quickstart & Local Development

### 1. Prerequisites
- Node.js v22+
- pnpm v11+ (`npm install -g pnpm`)
- Neon Serverless Postgres database (or local Postgres)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/ai-gateway.git
cd ai-gateway

# Install workspace dependencies
pnpm install

# Copy environment template and configure secrets
cp .env.example .env
```

### 3. Environment Configuration
Edit `.env` with your values:
```env
PORT=3000
DATABASE_URL=postgresql://user:password@endpoint.neon.tech/neondb?sslmode=require
MASTER_SECRET=your-secure-32-byte-master-secret-key-here!
JWT_SECRET=your-secure-32-byte-jwt-secret-key-here!
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-admin-password
ALLOWED_ORIGINS=*
```

### 4. Running the Dev Environment
```bash
# Start backend gateway and frontend dashboard concurrently
pnpm dev
```
- **Admin Dashboard**: `http://localhost:5173`
- **Gateway API**: `http://localhost:3000`
- **Health Check**: `http://localhost:3000/health`

### 5. Running Tests & Building
```bash
# Run unit & integration test suites across all packages
pnpm test

# Build all packages and applications for production
pnpm build
```

---

## 🔌 Connecting with OpenAI SDK

Once a Gateway API Key is generated (`sk-gw-...`) in the dashboard:

### TypeScript / Node.js
```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:3000/v1', // or your Render URL
  apiKey: process.env.GATEWAY_API_KEY, // sk-gw-...
});

// Works with provider slugs or custom aliases
const stream = await client.chat.completions.create({
  model: 'groq/llama-3.3-70b-versatile', // or custom alias e.g. 'fast-chat'
  messages: [{ role: 'user', content: 'Explain quantum computing in 20 words.' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### Python
```python
from openai import OpenAI
import os

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key=os.environ.get("GATEWAY_API_KEY"),
)

stream = client.chat.completions.create(
    model="groq/llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": "Explain zero-latency routing."}],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

---

## 🚢 Deploying to Render

### Method 1: Render Blueprint (Recommended)
1. Fork or push this repository to GitHub.
2. In the Render Dashboard, click **New +** -> **Blueprint**.
3. Connect your repository. Render detects [`render.yaml`](file:///D:/js/ai-gateway/render.yaml).
4. Set the `DATABASE_URL` environment variable to your Neon Postgres connection string.
5. Click **Apply**. Render will automatically build the workspace, run migrations, and serve the gateway with the embedded dashboard on a public HTTPS URL.

### Method 2: Docker Container
```bash
docker build -t ai-gateway .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e MASTER_SECRET="..." \
  -e JWT_SECRET="..." \
  -e ADMIN_PASSWORD="..." \
  ai-gateway
```

---

## 🧩 Adding a New Provider in 3 Steps

If your target provider is standard OpenAI-compatible (like DeepSeek, Mistral, Together, Ollama, Perplexity, vLLM), you **do not need code**—simply click **"Add Custom OpenAI Provider"** in the Web UI!

For providers requiring custom protocol or format translation:

### Step 1: Create the Package (`packages/provider-<name>`)
Create `packages/provider-<name>/package.json` and implement `ProviderAdapter`:

```typescript
// packages/provider-myprovider/src/index.ts
import type { ProviderAdapter, ProviderConfig, UnifiedModel, OpenAIChatCompletionRequest } from '@ai-gateway/core';

export class MyProviderAdapter implements ProviderAdapter {
  public readonly id = 'myprovider';
  public readonly name = 'My Custom Provider';
  public readonly defaultBaseUrl = 'https://api.myprovider.ai/v1';
  public readonly supportedCapabilities = ['chat', 'tools'];

  async listModels(config: ProviderConfig): Promise<Omit<UnifiedModel, 'slug' | 'isEnabled'>[]> {
    // Return live models or curated defaults
    return [{ id: 'model-v1', providerId: config.id, displayName: 'Model v1', capabilities: ['chat'] }];
  }

  async chatCompletions(request: OpenAIChatCompletionRequest, config: ProviderConfig, signal?: AbortSignal): Promise<Response> {
    return fetch(`${config.baseUrl || this.defaultBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    });
  }
}
```

### Step 2: Register in the Gateway Registry
In `apps/gateway/src/server.ts`:
```typescript
import { MyProviderAdapter } from '@ai-gateway/provider-myprovider';

// Inside buildServer():
registry.register(new MyProviderAdapter());
```

### Step 3: Link & Install Workspace
Add `@ai-gateway/provider-myprovider: "workspace:*"` to `apps/gateway/package.json` and run:
```bash
pnpm install
```

Your new provider is now immediately routable through the gateway and manageable in the Web Dashboard!

---

## 📄 License
MIT
