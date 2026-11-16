# OpenAI-Compatible Self-Hosted AI Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a low-latency, self-hosted, OpenAI-SDK-compatible AI Gateway with in-memory hot-path routing, zero-buffering streaming, AES-256-GCM credential encryption, Neon Serverless Postgres persistence, and a single-admin React 19 + shadcn/ui dashboard.

**Architecture:** A TypeScript monorepo using pnpm workspaces and Turborepo. Persistent state (encrypted keys, models, aliases, gateway keys, telemetry) lives in Neon Serverless Postgres via Drizzle ORM. The Fastify backend hydrates an in-memory routing cache on boot and invalidates on admin writes, serving `/v1/*` proxy requests strictly from memory without awaiting Postgres queries. Telemetry is logged asynchronously via a non-blocking queue.

**Tech Stack:** Node.js (v22+), TypeScript 5+, Fastify, Undici, Neon Serverless Postgres (`@neondatabase/serverless` + Drizzle ORM), React 19, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Vitest.

**Spec:** [`docs/superpowers/specs/2026-11-16-ai-gateway-design.md`](file:///D:/js/ai-gateway/docs/superpowers/specs/2026-11-16-ai-gateway-design.md)

## Global Constraints

- Monorepo package manager must be `pnpm` (`pnpm-workspace.yaml`) coordinated with `turbo.json`.
- Persistent state lives in Neon Serverless Postgres using `@neondatabase/serverless` with Drizzle ORM.
- Zero-DB-latency on `/v1/*`: inbound inference requests read strictly from in-memory cache without awaiting Postgres queries.
- Zero-buffering streaming: Undici SSE/binary readable streams pipe directly to client HTTP responses with AbortSignal cancellation.
- Non-blocking telemetry: Request metrics (TTFT, latency, status) are recorded via fire-and-forget async queue.
- Secret encryption: Upstream provider API keys encrypted at rest with AES-256-GCM (12-byte IV + 16-byte tag) derived from `MASTER_SECRET`. Gateway keys stored as SHA-256 hashes.
- Single admin auth uses signed HttpOnly JWT cookies.

## Review Focus

- Client disconnect during streaming: AbortSignal must terminate upstream undici fetch and fast-fail without unhandled rejection.
- Invalid or revoked Gateway Key: `/v1/*` routes return 401 with standard OpenAI JSON error shape `{"error":{"message":"...","type":"invalid_request_error","code":"invalid_api_key"}}`.
- Unknown or disabled model slug/alias: Returns 404 with OpenAI JSON error shape.
- Upstream HTTP errors (e.g., 429 rate limit, 503 capacity): Normalized into OpenAI error envelope with identical status code.
- Ephemeral restart recovery: Full in-memory routing cache rehydrates automatically on gateway boot from Neon Postgres.

---

### Task 1: Monorepo Scaffolding & Shared Tooling

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `packages/tsconfig/base.json`
- Create: `packages/tsconfig/node.json`
- Create: `packages/tsconfig/react.json`
- Create: `packages/tsconfig/package.json`
- Create: `vitest.workspace.ts`
- Test: `vitest.config.ts`

**Interfaces:**
- Produces: Monorepo workspace configuration with shared TypeScript configs and workspace-wide test runner.

- [ ] **Step 1: Write workspace configuration files**
  - Create root `package.json` with scripts (`build`, `test`, `dev`, `lint`, `typecheck`), `pnpm-workspace.yaml` defining `apps/*` and `packages/*`, and `turbo.json` defining pipeline tasks (`build`, `test`, `typecheck`).
  - Create `packages/tsconfig` with `base.json`, `node.json`, `react.json`, and `package.json`.
  - Create `vitest.workspace.ts` for workspace-level test execution.

- [ ] **Step 2: Run pnpm install and verify workspace**
  - Run: `pnpm install`
  - Expected: Clean install with lockfile generated.

- [ ] **Step 3: Run typecheck / test pipeline check**
  - Run: `pnpm test`
  - Expected: Vitest runs cleanly across workspace.

- [ ] **Step 4: Commit**
  - `git add . && git commit -m "chore: scaffold pnpm and turborepo monorepo with shared tsconfigs"`

---

### Task 2: Core Interfaces, Registry & Generic OpenAI Adapter (`packages/core`)

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/adapter.ts`
- Create: `packages/core/src/registry.ts`
- Create: `packages/core/src/adapters/generic-openai.ts`
- Create: `packages/core/src/errors.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/tests/generic-openai.test.ts`
- Test: `packages/core/tests/registry.test.ts`

**Interfaces:**
- Produces:
  - `ModelCapability`, `UnifiedModel`, `ProviderConfig`, `ProviderAdapter`, `GatewayKeyMetadata`
  - `OpenAIChatCompletionRequest`, `OpenAISpeechRequest`, `OpenAIErrorEnvelope`
  - `ProviderRegistry`: `register(adapter: ProviderAdapter): void`, `get(id: string): ProviderAdapter | undefined`, `list(): ProviderAdapter[]`
  - `GenericOpenAIAdapter`: Implements `ProviderAdapter` for standard OpenAI `/chat/completions` and `/models`
  - `createOpenAIError(message: string, code?: string, type?: string, status?: number)`

- [ ] **Step 1: Write tests for `ProviderRegistry` and `GenericOpenAIAdapter`**
  - Write tests in `packages/core/tests/registry.test.ts` testing adapter registration, lookup, and fallback.
  - Write tests in `packages/core/tests/generic-openai.test.ts` testing `listModels` and `chatCompletions` forwarding using mocked HTTP responses.

- [ ] **Step 2: Run tests to verify they fail**
  - Run: `pnpm --filter @ai-gateway/core test`
  - Expected: FAIL (modules not found).

- [ ] **Step 3: Implement core types, interfaces, errors, registry, and generic adapter**
  - Implement `types.ts` with Zod schemas and TypeScript interfaces.
  - Implement `errors.ts` creating standard OpenAI error format objects.
  - Implement `adapter.ts` with `ProviderAdapter` interface.
  - Implement `registry.ts` maintaining registered adapters Map.
  - Implement `adapters/generic-openai.ts` forwarding requests with undici/fetch, handling streaming and non-streaming.
  - Export public API from `index.ts`.

- [ ] **Step 4: Run tests to verify they pass**
  - Run: `pnpm --filter @ai-gateway/core test`
  - Expected: PASS with 100% tests passing.

- [ ] **Step 5: Commit**
  - `git add packages/core && git commit -m "feat(core): implement ProviderAdapter, GenericOpenAIAdapter, and ProviderRegistry"`

---

### Task 3: Database Schema & AES-256-GCM Crypto Helpers (`packages/db`)

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/crypto.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/migrate.ts`
- Create: `packages/db/src/index.ts`
- Test: `packages/db/tests/crypto.test.ts`
- Test: `packages/db/tests/schema.test.ts`

**Interfaces:**
- Consumes: `packages/core` types (`ModelCapability`).
- Produces:
  - `encryptSecret(plaintext: string, masterSecret: string): string` (outputs `iv:ciphertext:tag` in hex)
  - `decryptSecret(payload: string, masterSecret: string): string`
  - `hashGatewayKey(key: string): string` (SHA-256 in hex)
  - `hashPassword(password: string): Promise<string>` / `verifyPassword(password: string, hash: string): Promise<boolean>`
  - Drizzle tables: `providersTable`, `modelsTable`, `gatewayKeysTable`, `requestLogsTable`, `adminUsersTable`
  - `getDb(connectionString: string)`: returns Drizzle client instance

- [ ] **Step 1: Write failing tests for crypto functions**
  - Test encryption and decryption with AES-256-GCM, invalid auth tag tampering detection, short/long master secret handling, and SHA-256 key hashing in `packages/db/tests/crypto.test.ts`.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm --filter @ai-gateway/db test`
  - Expected: FAIL (modules not found).

- [ ] **Step 3: Implement crypto helpers and Drizzle schema**
  - Implement `crypto.ts` using Node.js native `crypto.createCipheriv('aes-256-gcm', key, iv)`.
  - Implement `schema.ts` defining `providers`, `models`, `gateway_keys`, `request_logs`, and `admin_users` tables.
  - Implement `client.ts` using `@neondatabase/serverless` and `drizzle-orm/neon-http`.
  - Implement `migrate.ts` with push/migration helper.
  - Export public API from `index.ts`.

- [ ] **Step 4: Run tests to verify they pass**
  - Run: `pnpm --filter @ai-gateway/db test`
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git add packages/db && git commit -m "feat(db): implement Drizzle schema and AES-256-GCM crypto helpers"`

---

### Task 4: Curated Provider Adapters (Groq, NVIDIA NIM, Google Gemini, ElevenLabs)

**Files:**
- Create: `packages/provider-groq/package.json`
- Create: `packages/provider-groq/tsconfig.json`
- Create: `packages/provider-groq/src/index.ts`
- Test: `packages/provider-groq/tests/groq.test.ts`
- Create: `packages/provider-nvidia/package.json`
- Create: `packages/provider-nvidia/tsconfig.json`
- Create: `packages/provider-nvidia/src/index.ts`
- Test: `packages/provider-nvidia/tests/nvidia.test.ts`
- Create: `packages/provider-google/package.json`
- Create: `packages/provider-google/tsconfig.json`
- Create: `packages/provider-google/src/index.ts`
- Test: `packages/provider-google/tests/google.test.ts`
- Create: `packages/provider-elevenlabs/package.json`
- Create: `packages/provider-elevenlabs/tsconfig.json`
- Create: `packages/provider-elevenlabs/src/index.ts`
- Test: `packages/provider-elevenlabs/tests/elevenlabs.test.ts`

**Interfaces:**
- Consumes: `@ai-gateway/core` (`ProviderAdapter`, `ProviderConfig`, `UnifiedModel`).
- Produces:
  - `groqAdapter`: `id: 'groq'`, `listModels`, `chatCompletions` (SSE/JSON), `transcribeAudio` (Whisper)
  - `nvidiaAdapter`: `id: 'nvidia'`, `listModels`, `chatCompletions` (SSE/JSON)
  - `googleAdapter`: `id: 'google'`, `listModels` (stripping `models/`), `chatCompletions` (OpenAI compat v1beta + SSE)
  - `elevenlabsAdapter`: `id: 'elevenlabs'`, `listModels`, `synthesizeSpeech` (audio/mpeg stream), `transcribeAudio` (Scribe translation), WebSocket bridge handler

- [ ] **Step 1: Write test suites for each provider adapter**
  - In `packages/provider-*/tests/*.test.ts`, write unit tests with mocked upstream endpoints verifying:
    - `listModels` parsing and normalization.
    - `chatCompletions` stream and non-stream forwarding.
    - `transcribeAudio` translation for Groq and ElevenLabs.
    - `synthesizeSpeech` streaming audio for ElevenLabs.

- [ ] **Step 2: Run provider tests to verify they fail**
  - Run: `pnpm --filter "@ai-gateway/provider-*" test`
  - Expected: FAIL (packages not found).

- [ ] **Step 3: Implement the 4 provider adapters**
  - Implement `provider-groq` targeting `https://api.groq.com/openai/v1`.
  - Implement `provider-nvidia` targeting `https://integrate.api.nvidia.com/v1`.
  - Implement `provider-google` targeting `https://generativelanguage.googleapis.com/v1beta/openai` with model normalization.
  - Implement `provider-elevenlabs` targeting `https://api.elevenlabs.io/v1`, translating speech synthesis to `text-to-speech/{voice_id}/stream` and STT to Scribe.

- [ ] **Step 4: Run tests to verify all 4 adapters pass**
  - Run: `pnpm --filter "@ai-gateway/provider-*" test`
  - Expected: All 4 provider test suites PASS.

- [ ] **Step 5: Commit**
  - `git add packages/provider-* && git commit -m "feat(providers): implement Groq, NVIDIA, Google, and ElevenLabs adapters"`

---

### Task 5: Backend Gateway Engine & Hot-Path Routing (`apps/gateway`)

**Files:**
- Create: `apps/gateway/package.json`
- Create: `apps/gateway/tsconfig.json`
- Create: `apps/gateway/src/config.ts`
- Create: `apps/gateway/src/undici-agent.ts`
- Create: `apps/gateway/src/cache/routing-cache.ts`
- Create: `apps/gateway/src/telemetry/log-queue.ts`
- Create: `apps/gateway/src/routes/health.ts`
- Create: `apps/gateway/src/routes/v1/auth.ts`
- Create: `apps/gateway/src/routes/v1/models.ts`
- Create: `apps/gateway/src/routes/v1/chat.ts`
- Create: `apps/gateway/src/routes/v1/audio.ts`
- Create: `apps/gateway/src/routes/admin/auth.ts`
- Create: `apps/gateway/src/routes/admin/providers.ts`
- Create: `apps/gateway/src/routes/admin/models.ts`
- Create: `apps/gateway/src/routes/admin/gateway-keys.ts`
- Create: `apps/gateway/src/routes/admin/logs.ts`
- Create: `apps/gateway/src/server.ts`
- Create: `apps/gateway/src/index.ts`
- Test: `apps/gateway/tests/health.test.ts`
- Test: `apps/gateway/tests/v1-routing.test.ts`
- Test: `apps/gateway/tests/admin-api.test.ts`

**Interfaces:**
- Consumes: `@ai-gateway/core`, `@ai-gateway/db`, and provider adapters.
- Produces:
  - Fastify server listening on `PORT`.
  - Hydrated in-memory `RoutingCache`:
    - `resolveModel(slugOrAlias: string): { model: UnifiedModel; provider: ProviderConfig; adapter: ProviderAdapter } | null`
    - `validateGatewayKey(key: string): GatewayKeyMetadata | null`
    - `refresh(): Promise<void>`
  - HTTP endpoints:
    - `GET /health`
    - `GET /v1/models`
    - `POST /v1/chat/completions` (SSE & JSON)
    - `POST /v1/audio/transcriptions`
    - `POST /v1/audio/speech`
    - `POST /api/admin/login`, `POST /api/admin/logout`
    - `GET/PUT /api/admin/providers`, `POST /api/admin/providers/:id/sync-models`
    - `PATCH /api/admin/models/:id`
    - `GET/POST/DELETE /api/admin/gateway-keys`
    - `GET /api/admin/logs`

- [ ] **Step 1: Write integration tests for gateway routes**
  - In `apps/gateway/tests/`:
    - `health.test.ts`: test `GET /health`.
    - `v1-routing.test.ts`: test auth validation (missing, invalid, valid), model resolution, streaming pipe, audio endpoints, and 401/404 OpenAI error shapes.
    - `admin-api.test.ts`: test admin login, cookie issuance, provider sync, model alias update, and key generation.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm --filter @ai-gateway/gateway test`
  - Expected: FAIL (server not built).

- [ ] **Step 3: Implement gateway engine, routing cache, and routes**
  - Implement `undici-agent.ts` with connection pooling (`keepAlive: true`, `pipelining: 1`).
  - Implement `routing-cache.ts` managing the in-memory Maps and database hydration.
  - Implement `log-queue.ts` non-blocking telemetry buffer with async batch flushing.
  - Implement `/health`, `/v1/*`, and `/api/admin/*` route handlers.
  - Setup Fastify with `@fastify/cors`, `@fastify/cookie`, and `@fastify/multipart`.
  - Implement `server.ts` building the app and initializing routing cache on start.

- [ ] **Step 4: Run gateway tests to verify they pass**
  - Run: `pnpm --filter @ai-gateway/gateway test`
  - Expected: All gateway tests PASS.

- [ ] **Step 5: Commit**
  - `git add apps/gateway && git commit -m "feat(gateway): implement Fastify server, in-memory cache, OpenAI /v1 routes, and admin API"`

---

### Task 6: Admin Web Dashboard (`apps/web`)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tailwind.config.js`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/components/ui/*` (Button, Input, Card, Badge, Switch, Dialog, Table, Tabs, Toaster)
- Create: `apps/web/src/components/Navbar.tsx`
- Create: `apps/web/src/pages/LoginPage.tsx`
- Create: `apps/web/src/pages/ProvidersPage.tsx`
- Create: `apps/web/src/pages/ModelsPage.tsx`
- Create: `apps/web/src/pages/KeysPage.tsx`
- Create: `apps/web/src/pages/PlaygroundPage.tsx`
- Test: `apps/web/tests/dashboard.test.tsx`

**Interfaces:**
- Consumes: `/api/admin/*` endpoints via TanStack Query.
- Produces: Single-page React 19 application with:
  - Login Card (admin credentials).
  - Providers Console (cards for Groq, NVIDIA, Google, ElevenLabs + "Add Custom OpenAI Provider" modal for DeepSeek/Ollama/etc. + credentials test & model sync).
  - Models & Aliases Table (filtering, search, capability badges, inline alias editor, toggle switch).
  - Gateway Keys Console (key generation modal, revoke button, copyable cURL / TS / Python OpenAI SDK snippets).
  - Playground & Latency Monitor (real-time chat stream with TTFT counter, STT file upload, TTS speech synthesis).

- [ ] **Step 1: Write UI component and render tests**
  - Test login view, provider card rendering, and playground state in `apps/web/tests/dashboard.test.tsx`.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm --filter @ai-gateway/web test`
  - Expected: FAIL (app not built).

- [ ] **Step 3: Build Web UI components, pages, and API hooks**
  - Setup Tailwind CSS, shadcn/ui components, and Lucide icons.
  - Implement `api.ts` with React Query hooks for providers, models, keys, and logs.
  - Implement `LoginPage`, `ProvidersPage` (with Add Custom OpenAI Provider modal), `ModelsPage`, `KeysPage`, and `PlaygroundPage`.
  - Connect dark theme and navigation.

- [ ] **Step 4: Build and test web app**
  - Run: `pnpm --filter @ai-gateway/web build`
  - Run: `pnpm --filter @ai-gateway/web test`
  - Expected: PASS with successful Vite production build.

- [ ] **Step 5: Commit**
  - `git add apps/web && git commit -m "feat(web): build React 19 single-admin dashboard with shadcn/ui"`

---

### Task 7: Operational Deliverables, Render Deployment & Documentation

**Files:**
- Create: `.env.example`
- Create: `render.yaml`
- Create: `Dockerfile`
- Create: `README.md`
- Test: Workspace verification script or comprehensive end-to-end suite

**Interfaces:**
- Produces:
  - `.env.example` with all configuration parameters.
  - `render.yaml` Blueprint for 1-click deployment on Render.
  - `Dockerfile` multi-stage optimized container for Render deployment.
  - `README.md` complete setup guide, architectural overview, and a concise 3-step guide for adding new provider packages.

- [ ] **Step 1: Write .env.example, render.yaml, and Dockerfile**
  - Configure `.env.example` with `DATABASE_URL`, `MASTER_SECRET`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ALLOWED_ORIGINS`, `PORT`.
  - Configure `render.yaml` specifying web service, build and start commands, and environment variable bindings.
  - Write multi-stage Dockerfile building all packages and serving the gateway + web UI.

- [ ] **Step 2: Write README.md**
  - Document setup, local dev (`pnpm dev`), running tests (`pnpm test`), deploying to Render with Neon, and the 3-step guide to add a new provider package (`packages/provider-*`).

- [ ] **Step 3: Run full workspace verification (Build, Test, Typecheck)**
  - Run: `pnpm build && pnpm test && pnpm typecheck`
  - Expected: Clean pass across all apps and packages with zero errors.

- [ ] **Step 4: Commit**
  - `git add . && git commit -m "docs: add render deployment blueprint, dockerfile, .env.example, and documentation"`
