# Architecture Design: OpenAI-Compatible Self-Hosted AI Gateway

**Status:** Proposed  
**Date:** 2026-11-16  
**Target Deployment:** Render (ephemeral container filesystem) + Neon Serverless Postgres  

---

## 1. Intent & Context

Modern AI architectures frequently interact with multiple AI providers for specialized capabilities (e.g., Groq for ultra-fast Llama inference and Whisper STT, NVIDIA NIM for open-source model exploration, Google Gemini for multimodal reasoning, and ElevenLabs for expressive speech synthesis and transcription). Directly managing multiple client SDKs, diverse authentication schemes, differing payload formats, and separate billing/access keys inside applications introduces massive technical debt and operational risk.

This project delivers a **low-latency, self-hosted, OpenAI-SDK-compatible AI Gateway** paired with an intuitive **single-admin Web Dashboard**. The gateway presents a single `baseURL` and unified gateway API keys (`sk-gw-...`) while routing requests across upstream providers. Crucially, the gateway includes a **built-in Generic OpenAI-Compatible Adapter**, enabling admins to immediately integrate any OpenAI-compatible provider (e.g., DeepSeek, Mistral, Together AI, Ollama, Perplexity, vLLM) directly via the Web UI simply by providing a base URL and API key—without writing or deploying new packages.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1 Goals
- **Full OpenAI SDK Compatibility**: Drop-in replacement for standard OpenAI SDK clients (`openai.chat.completions.create`, `openai.audio.transcriptions.create`, `openai.audio.speech.create`, and `openai.models.list`).
- **Zero-DB Latency on Hot Path**: The `/v1/*` routing pipeline resolves models, providers, decrypted upstream keys, and gateway key validation strictly against an in-memory `Map` cache. No Postgres queries block inbound inference requests.
- **Render-Ready Ephemeral Architecture**: All persistent state lives in Neon Serverless Postgres (`@neondatabase/serverless` + Drizzle ORM). When Render dynos restart or redeploy, the gateway hydrates its in-memory routing cache immediately upon boot.
- **Generic OpenAI-Compatible Provider Support**: Users can add any standard OpenAI-compatible provider via the UI (setting name, base URL, API key) instantly, alongside curated dedicated adapters.
- **Dedicated Adapters for Non-Standard Formats**:
  - `provider-groq`: High-throughput Chat Completions (SSE stream + JSON) + Whisper STT.
  - `provider-nvidia`: NVIDIA NIM Chat Completions (SSE stream + JSON).
  - `provider-google`: Gemini OpenAI-compatible completions with model normalization (`gemini-2.5-flash`, etc.) and SSE streaming.
  - `provider-elevenlabs`: Bidirectional mapping:
    - TTS `/v1/audio/speech`: High-performance chunked audio streaming (`/v1/text-to-speech/{voice_id}/stream` with `optimize_streaming_latency`) piped directly to OpenAI SDK clients, plus optional WebSocket client bridge (`stream-input`) support for real-time bidirectional audio streaming.
    - STT `/v1/audio/transcriptions`: Translates multipart audio to ElevenLabs Scribe STT and returns standard OpenAI JSON.
- **Zero-Buffering Streaming Across All Providers**:
  - Direct piping of undici upstream `ReadableStream` / SSE chunks to client response with zero memory buffering.
  - Client disconnection abortion: Client socket `close`/`abort` triggers `AbortController.abort()` to terminate upstream requests immediately.
  - TTFT (Time-To-First-Token) tracking: Measured upon receipt of the first SSE chunk or first audio chunk, captured for non-blocking telemetry.
- **Zero-Delay Telemetry**: Request logs (latency, TTFT, model, provider, status) are queued and inserted asynchronously into Neon Postgres without blocking client HTTP responses.
- **Security by Default**: Upstream provider API keys encrypted at rest with AES-256-GCM derived from `MASTER_SECRET`. Gateway API keys hashed with SHA-256 before persistence. Single admin authenticated via signed JWT cookie (HttpOnly, Secure, SameSite).

### 2.2 Non-Goals
- Multi-tenant team billing or credit-metering system (designed as single-tenant / single-admin self-hosted gateway).
- Complex model cascading or automated fallbacks (routing is model slug / alias based; fallback logic can be added in future iterations).
- Persistent audio file storage (gateway streams audio directly through memory without disk persistence).

### 2.3 Anti-Goals
- Awaiting database queries on `/v1/*` hot path requests.
- Storing unencrypted upstream API keys in Postgres.
- Buffering entire streaming completions before flushing headers or chunks.
- Forcing code modifications or package deployments for standard OpenAI-compatible endpoints.

---

## 3. Approaches Considered & Trade-offs

| Decision Point | Option A (Selected) | Option B | Rationale |
|---|---|---|---|
| **Backend Framework** | **Fastify on Node.js** | Hono / Express | Fastify provides top-tier Node.js throughput, native undici connection pooling, first-class streaming pipeline support, robust multipart parsing (`@fastify/multipart`), and mature cookie handling (`@fastify/cookie`). |
| **OpenAI-Compatible Extensibility** | **Built-in Generic OpenAI Adapter + Curated Packages** | Dedicated package required for every provider | Generic adapter allows zero-code addition of DeepSeek, Mistral, Together, Ollama, etc. Dedicated packages remain for providers needing format translation (ElevenLabs, Google, Groq). |
| **Hot Path State Management** | **In-Memory Cache with DB Hydration on Boot + Sync on Admin Write** | Querying Neon Postgres per request | Querying serverless Postgres on every `/v1/chat/completions` request would add 15-50ms+ latency. In-memory Map lookup is <0.1ms. |
| **Telemetry Persistence** | **Non-blocking asynchronous worker/buffer** | Synchronous DB write on response finish | Async fire-and-forget guarantees response time is never penalized by Postgres network latency. |
| **Secret Encryption** | **AES-256-GCM with random 12-byte IV + 16-byte Auth Tag** | Plaintext or AES-CBC | AES-256-GCM ensures authenticated encryption with integrity protection against tampering. |

---

## 4. System Architecture & Monorepo Layout

A **pnpm workspace** orchestrated with **Turborepo**:

```text
ai-gateway/
├── apps/
│   ├── gateway/                  # Fastify low-latency API server (Render deployment)
│   │   ├── src/
│   │   │   ├── cache/            # In-memory routing cache (hydrated from Neon)
│   │   │   ├── routes/
│   │   │   │   ├── v1/           # /v1/models, /v1/chat/completions, /v1/audio/*
│   │   │   │   ├── admin/        # /api/admin/* (providers, models, keys, logs, auth)
│   │   │   │   └── health.ts     # GET /health
│   │   │   ├── telemetry/        # Async non-blocking log batcher
│   │   │   ├── undici.ts         # Connection pool agent configuration
│   │   │   └── server.ts         # Fastify initialization & lifecycle hooks
│   │   └── Dockerfile
│   └── web/                      # Single-admin React + Vite + Tailwind + shadcn/ui dashboard
│       ├── src/
│       │   ├── components/       # shadcn/ui components (cards, dialogs, tables, switches)
│       │   ├── pages/            # Login, Providers, Models, Keys, Playground
│       │   ├── lib/api.ts        # TanStack Query & Axios/Fetch admin client
│       │   └── App.tsx
├── packages/
│   ├── core/                     # ProviderAdapter interface, GenericOpenAIAdapter, Registry, Zod types
│   ├── db/                       # Neon HTTP connection, Drizzle schema, AES-256-GCM crypto helpers
│   ├── provider-groq/            # Groq adapter (Chat + Whisper STT + listModels)
│   ├── provider-nvidia/          # NVIDIA NIM adapter (Chat + listModels)
│   ├── provider-google/          # Google Gemini adapter (Chat + model normalization + listModels)
│   ├── provider-elevenlabs/      # ElevenLabs adapter (TTS stream + Scribe STT + listModels)
│   └── tsconfig/                 # Shared base tsconfig files
├── render.yaml                   # Render Blueprint
├── .env.example
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## 5. Core Interfaces & Generic Provider Mechanism

### 5.1 Provider Adapter Interface (`packages/core`)
```typescript
export type ModelCapability = 'chat' | 'embeddings' | 'stt' | 'tts' | 'vision' | 'tools';

export interface UnifiedModel {
  id: string;                 // e.g., "llama-3.3-70b-versatile" or "deepseek-chat"
  providerId: string;         // e.g., "groq", "custom-deepseek", "elevenlabs"
  slug: string;               // Routable identifier, e.g., "groq/llama-3.3-70b-versatile"
  displayName: string;
  capabilities: ModelCapability[];
  contextWindow?: number;
  isEnabled: boolean;
}

export interface ProviderConfig {
  id: string;
  name: string;
  adapterType: string;        // 'groq' | 'nvidia' | 'google' | 'elevenlabs' | 'openai-compatible'
  baseUrl?: string;
  apiKey: string;
  extraHeaders?: Record<string, string>;
  customOptions?: Record<string, unknown>;
  isEnabled: boolean;
}

export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly defaultBaseUrl: string;
  readonly supportedCapabilities: ModelCapability[];

  listModels(config: ProviderConfig): Promise<Omit<UnifiedModel, 'slug' | 'isEnabled'>[]>;

  chatCompletions?(
    request: OpenAIChatCompletionRequest,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response>;

  transcribeAudio?(
    formData: FormData,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response>;

  synthesizeSpeech?(
    request: OpenAISpeechRequest,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response>;

  /** Optional real-time WebSocket connection handler for bidirectional streaming (e.g. ElevenLabs stream-input) */
  streamSpeechWebSocket?(
    ws: any,
    config: ProviderConfig,
    params: { voiceId: string; modelId?: string }
  ): Promise<void>;
}
```

### 5.2 Built-in Generic OpenAI-Compatible Adapter (`GenericOpenAIAdapter`)
For any provider registered with `adapterType: 'openai-compatible'` (or any custom provider added via the dashboard):
- **Base URL**: User-configured (e.g. `https://api.deepseek.com/v1`, `https://openrouter.ai/api/v1`, `http://localhost:11434/v1`).
- **`listModels`**: Calls `GET ${baseUrl}/models` with `Authorization: Bearer ${apiKey}` and maps the items into `UnifiedModel[]`.
- **`chatCompletions`**: Passes standard OpenAI JSON to `POST ${baseUrl}/chat/completions` using native `undici.fetch` with `duplex: 'half'` and forwards the stream/response directly.
- **Transcriptions / Speech**: Can optionally be passed through if the target provider supports standard OpenAI audio endpoints.

---

## 6. Hot-Path Routing & In-Memory Cache

1. **Hydration on Startup**:
   - `gateway` connects to Neon Serverless Postgres on boot.
   - Decrypts all enabled provider API keys using `MASTER_SECRET`.
   - Hydrates:
     - `providersMap`: `Map<providerId, ProviderConfig>`
     - `modelsMap`: `Map<slugOrAlias, { model: UnifiedModel; provider: ProviderConfig; adapter: ProviderAdapter }>`
     - `gatewayKeysMap`: `Map<sha256Hash, GatewayKeyMetadata>`
2. **Admin Mutation Invalidation**:
   - When an admin updates a provider, toggles a model, adds an alias, or creates/revokes a gateway key via `/api/admin/*`, the record is written to Neon Postgres and the in-memory cache is immediately refreshed in-place.
3. **Hot-Path Request Execution (`/v1/*`)**:
   - 1. Extract Bearer token from `Authorization` header.
   - 2. Compute SHA-256 hash in-memory. Verify against `gatewayKeysMap`. (Reject 401 if missing/invalid).
   - 3. Parse requested `model` parameter. Look up in `modelsMap` (supports both slug `provider/model-id` and custom aliases like `fast-chat`).
   - 4. Route directly to adapter (`chatCompletions`, `transcribeAudio`, or `synthesizeSpeech`).
   - 5. Pipe response stream directly to Fastify `reply.raw` with upstream headers (`Content-Type`, `Cache-Control`).
   - 6. Record telemetry asynchronously (fire-and-forget).

---

## 7. Web Dashboard Architecture (React 19 + shadcn/ui)

Single-admin dashboard featuring:
1. **Login Page**: Clean card authentication issuing HttpOnly cookie.
2. **Providers Console**:
   - Card grid for built-in providers (Groq, NVIDIA NIM, Google Gemini, ElevenLabs).
   - **"Add Custom OpenAI Provider"** modal allowing dynamic addition of any OpenAI-compatible provider (DeepSeek, Together, Ollama, etc.) with custom Base URL and API Key.
   - Inline API Key toggle (masked/revealed), connection test, and "Sync Live Models" button.
3. **Models & Aliases Management**:
   - Searchable, filterable table across all discovered models.
   - Inline editing for short custom aliases (e.g. `fast-chat -> groq/llama-3.3-70b-versatile`).
   - Capabilities badges (`chat`, `stt`, `tts`, `vision`, `tools`).
   - Instant enable/disable switch.
4. **Gateway Keys & Quickstart**:
   - Key generator (`sk-gw-...`), last used timestamp, revoke actions.
   - Interactive code snippet generator (cURL, Python OpenAI SDK, TypeScript OpenAI SDK) pre-filled with gateway URL.
5. **Interactive Playground & Latency Monitor**:
   - Test Chat Completions (with real-time token streaming and Time-To-First-Token TTFT ms measurement).
   - Test STT (audio file upload -> transcribed text).
   - Test TTS (text input -> playable audio waveform).
   - Real-time latency chart / recent telemetry inspect drawer.

---

## 8. Deployment & Operational Blueprint

- **Database**: Neon Serverless Postgres database connected over SSL via `@neondatabase/serverless`.
- **Backend Deployment**: Render Web Service running Node 22+ with `pnpm --filter @ai-gateway/gateway start`.
- **Frontend Deployment**: Can either be hosted on Render Static Sites / Vercel or served directly via Fastify `@fastify/static` in single-container mode.
- **Environment Variables**:
  - `DATABASE_URL`: Neon Postgres connection string
  - `MASTER_SECRET`: 32+ byte string used to derive AES-256 key
  - `JWT_SECRET`: Signing secret for admin session JWTs
  - `ADMIN_USERNAME`: Admin login username
  - `ADMIN_PASSWORD_HASH`: Scrypt/bcrypt hash of initial admin password
  - `ALLOWED_ORIGINS`: CORS origins for Web UI
  - `PORT`: Server port (default 3000 / Render `$PORT`)

---

## 9. Decisions Decided vs Left to Builder

### Decided
- Fastify on Node.js with undici connection pooling.
- Neon Serverless Postgres + Drizzle ORM.
- AES-256-GCM encryption for provider keys; SHA-256 for gateway keys.
- Generic OpenAI provider adapter built-in for zero-package addition of OpenAI-compatible APIs.
- Dedicated adapters for Groq, NVIDIA NIM, Google Gemini, ElevenLabs.
- Monorepo structure using pnpm + Turborepo.

### Left to Builder
- Specific Drizzle migration script runner implementation (`drizzle-kit push` vs programmatic migrations on startup).
- Specific styling details and layout components for shadcn/ui dashboard.
- Default curated fallback model lists for when upstream provider `/models` endpoints are temporarily unreachable.
