# Full OpenAI SDK Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the AI Gateway from its current high-performance core (Chat, Audio Speech TTS, Audio Transcriptions STT, Models) to **100% full-surface parity with all resources, endpoints, and streaming behaviors supported by the official OpenAI Node.js / Python SDKs**.

**Architecture:** Maintain the sub-millisecond Zero-DB in-memory routing cache on hot generation paths while introducing modular Fastify route plugins, provider adapter contracts, S3/blob storage for files, and background worker queues for asynchronous batches and persistent stateful agents (Assistants v2, Vector Stores, Threads & Realtime WebSockets).

**Tech Stack:** Fastify v5, TypeScript 5.8, Drizzle ORM + Neon Serverless Postgres (with pgvector), Node 22/24 Streams & WebSockets (`@fastify/websocket`), S3-compatible Blob Storage (Cloudflare R2, MinIO, or local disk), `@ai-gateway/core`.

**Source Reference:** Cloned and analyzed from [`openai/openai-node`](https://github.com/openai/openai-node) (v4.86+ / 2026 release).

---

## Global Constraints

- **100% OpenAI Wire Compatibility**: Any client using `new OpenAI({ baseURL: 'http://localhost:3000/v1', apiKey: 'sk-gw-...' })` must work out of the box with zero code changes.
- **Sub-millisecond Hot Path**: `POST /v1/chat/completions`, `POST /v1/embeddings`, and `POST /v1/audio/speech` must resolve routing in `<1ms` via RAM lookup without blocking database round-trips.
- **Provider Agnostic**: All routes must route transparently to whichever upstream provider satisfies the capability (e.g. Groq, Nvidia, ElevenLabs, Google Gemini, OpenAI, Cohere, DeepSeek, Together, Ollama).
- **Graceful Error Normalization**: All errors must strictly follow the OpenAI error envelope `{ error: { message, type, code, param } }`.
- **Streaming Fidelity**: SSE routes (`/v1/chat/completions`, `/v1/threads/runs`, `/v1/audio/speech`) must preserve standard data frames, `data: [DONE]`, and `stream_options.include_usage`.

---

## Review Focus

1. **Client Auto-Pagination & Envelopes**: OpenAI SDK list methods expect `{ object: 'list', data: [...], has_more: false }` or cursor pagination (`first_id`, `last_id`); missing envelopes cause client crashes.
2. **Multipart Form-Data Handling**: Endpoints like `/v1/files`, `/v1/audio/transcriptions`, and `/v1/images/edits` require high-throughput streaming multipart parsing without loading gigabyte files entirely into RAM.
3. **Structured Outputs & Strict Schemas**: `response_format: { type: 'json_schema', json_schema: { strict: true } }` must be correctly forwarded or enforced on non-OpenAI upstreams.
4. **WebSocket Realtime State Machine**: `/v1/realtime` requires sub-50ms bidirectional frame forwarding, handling partial audio buffers, speech turn-taking (VAD), and interruptions cleanly.
5. **Background Batch Processing Isolation**: Asynchronous `/v1/batches` execution must not starve gateway CPU/RAM or saturate upstream provider rate limits.

---

## Feature Roadmap & Task Decomposition

```
Phases of Implementation:
 Phase 1: Core Generation Primitives (Embeddings, Audio Translations, Legacy Completions)
 Phase 2: Multimodal & Safety (Image Generation/Edits/Variations, Moderations)
 Phase 3: Files & Batch Processing (Multipart File Storage, 24-hr Asynchronous Batches)
 Phase 4: Semantic Retrieval & Vector Stores (pgvector, Document Chunking, File Batches)
 Phase 5: Assistants v2 & Stateful Agent Engine (Threads, Messages, Runs, Tool Output Submission)
 Phase 6: Realtime API (Bidirectional Audio/Text WebSockets Bridge)
 Phase 7: Verification, Examples & Admin Console Integration
```

---

### Task 1: Vector Embeddings Endpoint (`POST /v1/embeddings`)

**Files:**
- Create: `apps/gateway/src/routes/v1/embeddings.ts`
- Modify: `packages/core/src/adapter.ts:30-45`
- Modify: `packages/core/src/adapters/generic-openai.ts:110-140`
- Modify: `packages/provider-nvidia/src/index.ts:50-80`
- Modify: `apps/gateway/src/routes/v1/index.ts`
- Test: `apps/gateway/tests/v1-embeddings.test.ts`

- [ ] **Step 1: Write the failing test**
  Create `apps/gateway/tests/v1-embeddings.test.ts` testing:
  - Single string input: `{ model: "text-embedding-3-small", input: "Hello world" }`
  - Array of strings input: `{ model: "text-embedding-3-small", input: ["Doc 1", "Doc 2"] }`
  - Truncated Matryoshka dimensions: `{ model: "text-embedding-3-large", input: "test", dimensions: 512 }`
  - Base64 encoding format: `{ encoding_format: "base64" }`
  - OpenAI response envelope verification: `{ object: "list", data: [{ object: "embedding", embedding: [...], index: 0 }], model: "...", usage: { prompt_tokens: 2, total_tokens: 2 } }`.

- [ ] **Step 2: Define Adapter Contract & Types**
  In `packages/core/src/adapter.ts`, add:
  ```typescript
  export interface OpenAIEmbeddingRequest {
    model: string;
    input: string | string[] | number[] | number[][];
    dimensions?: number;
    encoding_format?: 'float' | 'base64';
    user?: string;
  }
  export interface OpenAIEmbeddingResponse {
    object: 'list';
    data: Array<{ object: 'embedding'; embedding: number[] | string; index: number }>;
    model: string;
    usage: { prompt_tokens: number; total_tokens: number };
  }
  ```
  Add optional `createEmbeddings?(request: OpenAIEmbeddingRequest, config: ProviderConfig, signal?: AbortSignal): Promise<OpenAIEmbeddingResponse>` to `ProviderAdapter`.

- [ ] **Step 3: Implement Upstream Adapters**
  - Implement `createEmbeddings` in `generic-openai.ts` mapping to `${baseUrl}/embeddings`.
  - Implement `createEmbeddings` in `packages/provider-nvidia/src/index.ts` routing to Nvidia NeMo Embedding models (e.g. `nvidia/nv-embedqa-e5-v5`).

- [ ] **Step 4: Implement Fastify Route & In-Memory Route Resolution**
  Create `apps/gateway/src/routes/v1/embeddings.ts`:
  - Enforce `authenticateGatewayKey`.
  - Lookup model via zero-DB `fastify.routingCache.resolveModel(body.model)`.
  - Validate model has `capabilities: ['embeddings']`.
  - Execute adapter and return JSON response.
  - Asynchronously record request telemetry log to DB without blocking response.

- [ ] **Step 5: Run tests and verify**
  Run `pnpm --filter @ai-gateway/gateway test` and confirm `v1-embeddings.test.ts` passes.

---

### Task 2: Audio Translation Endpoint (`POST /v1/audio/translations`)

**Files:**
- Modify: `packages/core/src/adapter.ts:40-60`
- Modify: `packages/core/src/adapters/generic-openai.ts:130-160`
- Modify: `packages/provider-groq/src/index.ts:70-95`
- Modify: `apps/gateway/src/routes/v1/audio.ts:80-140`
- Test: `apps/gateway/tests/v1-audio-translations.test.ts`

- [ ] **Step 1: Write the failing test**
  Create `apps/gateway/tests/v1-audio-translations.test.ts` testing:
  - `POST /v1/audio/translations` with multipart form-data `file` (foreign language audio) and `model: "whisper-large-v3-turbo"`.
  - Formats: JSON (`{ text: "English translation..." }`), verbose_json, srt, vtt.

- [ ] **Step 2: Add Adapter Translation Contract**
  Add `translateAudio?(formData: FormData, config: ProviderConfig, signal?: AbortSignal): Promise<Response>` to `ProviderAdapter`.

- [ ] **Step 3: Implement Fastify Route**
  In `apps/gateway/src/routes/v1/audio.ts`, register `POST /v1/audio/translations`:
  - Consume streaming multipart form-data via `@fastify/multipart`.
  - Route to Whisper-capable provider (Groq or OpenAI).
  - Forward translation result in requested format.

- [ ] **Step 4: Run tests and commit**
  Confirm test passes; commit as `feat(gateway): add /v1/audio/translations route`.

---

### Task 3: Images API (`POST /v1/images/generations`, `edits`, `variations`)

**Files:**
- Create: `apps/gateway/src/routes/v1/images.ts`
- Create: `packages/core/src/adapters/images.ts`
- Modify: `packages/core/src/adapter.ts`
- Modify: `apps/gateway/src/routes/v1/index.ts`
- Test: `apps/gateway/tests/v1-images.test.ts`

- [ ] **Step 1: Write the failing test**
  Create `apps/gateway/tests/v1-images.test.ts` testing:
  - `POST /v1/images/generations`: `{ prompt: "cyberpunk city", model: "dall-e-3", n: 1, size: "1024x1024", response_format: "url" }`.
  - Verify OpenAI response structure: `{ created: 1710000000, data: [{ url: "https://...", revised_prompt: "..." }] }`.
  - Base64 format: `{ response_format: "b64_json" }` -> `{ data: [{ b64_json: "..." }] }`.
  - `POST /v1/images/edits` (multipart with image, mask, prompt).
  - `POST /v1/images/variations` (multipart with image).

- [ ] **Step 2: Implement Image Generation Adapter & Routing**
  - Implement image contract supporting DALL-E, Stability AI, and FLUX (Black Forest Labs via Together/Replicate/OpenAI-compatible).
  - Add `generateImages`, `editImages`, `createImageVariations` to `packages/core/src/adapter.ts`.

- [ ] **Step 3: Register Fastify Routes**
  In `apps/gateway/src/routes/v1/images.ts`, register `/v1/images/generations`, `/v1/images/edits`, and `/v1/images/variations`.

- [ ] **Step 4: Run tests and verify**
  Run `pnpm test` and ensure all image tests pass.

---

### Task 4: Content Moderation Endpoint (`POST /v1/moderations`)

**Files:**
- Create: `apps/gateway/src/routes/v1/moderations.ts`
- Modify: `packages/provider-nvidia/src/index.ts` (Llama-Guard-4 integration)
- Modify: `packages/core/src/adapter.ts`
- Modify: `apps/gateway/src/routes/v1/index.ts`
- Test: `apps/gateway/tests/v1-moderations.test.ts`

- [ ] **Step 1: Write the failing test**
  Create `apps/gateway/tests/v1-moderations.test.ts` testing:
  - Input: `{ input: "Sample benign text" }`
  - Output envelope: `{ id: "modr-...", model: "omni-moderation-latest", results: [{ flagged: false, categories: { hate: false, harassment: false, ... }, category_scores: { hate: 0.001, ... } }] }`.
  - Flagged input behavior with policy categories.

- [ ] **Step 2: Implement Adapter & Moderation Normalization**
  - Connect to upstream moderation (OpenAI moderation or Nvidia `meta/llama-guard-4-12b` classification adapter).
  - Normalize classifications to standard OpenAI category dictionary (`hate`, `hate/threatening`, `harassment`, `self-harm`, `sexual`, `sexual/minors`, `violence`, `violence/graphic`).

- [ ] **Step 3: Register Fastify Route**
  Register `POST /v1/moderations` in `apps/gateway/src/routes/v1/moderations.ts`.

---

### Task 5: Persistent Files API (`/v1/files`) & Multipart Chunked Uploads (`/v1/uploads`)

**Files:**
- Create: `packages/db/src/schema/files.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `apps/gateway/src/services/storage.ts`
- Create: `apps/gateway/src/routes/v1/files.ts`
- Create: `apps/gateway/src/routes/v1/uploads.ts`
- Test: `apps/gateway/tests/v1-files.test.ts`

- [ ] **Step 1: Design DB Schema for Files & Uploads**
  In `packages/db/src/schema/files.ts`:
  ```typescript
  export const filesTable = pgTable('files', {
    id: varchar('id', { length: 64 }).primaryKey(), // 'file-abc123xyz'
    bytes: integer('bytes').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    purpose: varchar('purpose', { length: 64 }).notNull(), // 'assistants', 'batch', 'fine-tune'
    storagePath: text('storage_path').notNull(), // local file path or S3 key
    status: varchar('status', { length: 32 }).default('uploaded').notNull(),
  });
  ```
  Create `uploadsTable` and `uploadPartsTable` for resumable multipart uploads.

- [ ] **Step 2: Implement Storage Service Abstraction**
  `apps/gateway/src/services/storage.ts`: Supports local disk storage (default for standalone dev) and S3/R2 storage (for production cluster).
  Methods: `saveFileStream`, `getFileStream`, `deleteFile`, `getFileMetadata`.

- [ ] **Step 3: Implement `/v1/files` Routes**
  - `POST /v1/files`: Multipart upload (returns `FileObject`).
  - `GET /v1/files`: Lists files filtered by `purpose` (`{ object: 'list', data: [...] }`).
  - `GET /v1/files/:file_id`: Returns metadata.
  - `GET /v1/files/:file_id/content`: Streams binary file bytes.
  - `DELETE /v1/files/:file_id`: Revokes and deletes from storage.

- [ ] **Step 4: Implement `/v1/uploads` Routes**
  - `POST /v1/uploads`: Initializes a multi-part upload session (`bytes`, `filename`, `purpose`).
  - `POST /v1/uploads/:upload_id/parts`: Appends chunk part (`part_id`).
  - `POST /v1/uploads/:upload_id/complete`: Stitches parts and creates final `file-` entry.

- [ ] **Step 5: Run tests and commit**
  Verify complete file lifecycle via `v1-files.test.ts`.

---

### Task 6: Asynchronous Batches API (`POST /v1/batches`)

**Files:**
- Create: `packages/db/src/schema/batches.ts`
- Create: `apps/gateway/src/services/batch-processor.ts`
- Create: `apps/gateway/src/routes/v1/batches.ts`
- Test: `apps/gateway/tests/v1-batches.test.ts`

- [ ] **Step 1: Design DB Schema for Batches**
  In `packages/db/src/schema/batches.ts`:
  - `id`: `batch_...`
  - `inputFileId`: points to `files.id` containing `.jsonl` lines.
  - `outputFileId`: points to output `.jsonl`.
  - `errorFileId`: points to error `.jsonl`.
  - `endpoint`: `/v1/chat/completions` or `/v1/embeddings`.
  - `status`: `validating` | `in_progress` | `completed` | `failed` | `expired` | `cancelling` | `cancelled`.
  - `requestCounts`: `{ total, completed, failed }`.

- [ ] **Step 2: Build Asynchronous Batch Processing Engine**
  `apps/gateway/src/services/batch-processor.ts`:
  - Worker process (concurrency limited to prevent overwhelming upstreams).
  - Streams `inputFileId` line by line (each containing `custom_id`, `method`, `url`, `body`).
  - Executes each request through gateway router and writes to `.jsonl` output stream.
  - Automatically updates batch progress and sets `status = 'completed'`.

- [ ] **Step 3: Implement Fastify Batch Routes**
  - `POST /v1/batches`: Initiates batch job.
  - `GET /v1/batches/:batch_id`: Returns batch status and request counts.
  - `POST /v1/batches/:batch_id/cancel`: Gracefully halts in-progress batch.
  - `GET /v1/batches`: Cursor-paginated listing.

- [ ] **Step 4: Run tests and verify**
  Run `v1-batches.test.ts` and confirm batch execution.

---

### Task 7: Vector Stores API (`/v1/vector_stores`)

**Files:**
- Create: `packages/db/src/schema/vector-stores.ts`
- Create: `apps/gateway/src/services/chunking.ts`
- Create: `apps/gateway/src/routes/v1/vector-stores.ts`
- Test: `apps/gateway/tests/v1-vector-stores.test.ts`

- [ ] **Step 1: DB Schema with pgvector**
  In `packages/db/src/schema/vector-stores.ts`:
  - `vectorStoresTable`: `id` (`vs_...`), `name`, `status`, `fileCounts`.
  - `vectorStoreFilesTable`: `id`, `vectorStoreId`, `fileId`, `status`, `chunkingStrategy`.
  - `vectorChunksTable`: `id`, `vectorStoreId`, `fileId`, `content`, `embedding` (vector type `vector(1536)`), `metadata`.

- [ ] **Step 2: Document Chunking & Embeddings Engine**
  `apps/gateway/src/services/chunking.ts`:
  - Implements `AutoFileChunkingStrategyParam` and `StaticFileChunkingStrategy` (max tokens, chunk overlap).
  - Pipes file text through gateway embeddings endpoint to index vectors into Postgres.

- [ ] **Step 3: Implement `/v1/vector_stores` Routes**
  - `POST /v1/vector_stores`: Create vector store.
  - `GET /v1/vector_stores`: List vector stores.
  - `GET /v1/vector_stores/:id`: Retrieve details.
  - `POST /v1/vector_stores/:id/files`: Associate uploaded file and trigger chunking/embedding.
  - `POST /v1/vector_stores/:id/file_batches`: Batch attach files.
  - `DELETE /v1/vector_stores/:id`: Purge store and index.

---

### Task 8: Assistants v2 & Stateful Agent Engine (`/v1/assistants`, `/v1/threads`, `/v1/runs`)

**Files:**
- Create: `packages/db/src/schema/assistants.ts`
- Create: `apps/gateway/src/services/assistant-runner.ts`
- Create: `apps/gateway/src/routes/v1/assistants.ts`
- Create: `apps/gateway/src/routes/v1/threads.ts`
- Test: `apps/gateway/tests/v1-assistants.test.ts`

- [ ] **Step 1: DB Schema for Assistants, Threads, Messages & Runs**
  - `assistantsTable`: `id` (`asst_...`), `name`, `model`, `instructions`, `tools` (JSON array: code_interpreter, file_search, function), `toolResources`.
  - `threadsTable`: `id` (`thread_...`), `metadata`.
  - `threadMessagesTable`: `id` (`msg_...`), `threadId`, `role`, `content`, `attachments`.
  - `runsTable`: `id` (`run_...`), `threadId`, `assistantId`, `status` (`queued`, `in_progress`, `requires_action`, `completed`), `requiredAction` (tool call arguments).
  - `runStepsTable`: `id` (`step_...`), `runId`, `type` (`message_creation` | `tool_calls`), `stepDetails`.

- [ ] **Step 2: Execution State Machine & Streaming Engine**
  `apps/gateway/src/services/assistant-runner.ts`:
  - Resolves conversation history from `threads` and `messages`.
  - Performs vector search over associated `vector_stores` (RAG augmentation).
  - Executes tool calling loop: if model requests tool calls, moves run state to `requires_action` and emits `thread.run.requires_action`.
  - Supports SSE streaming format (`runs.stream()`): emits `thread.message.created`, `thread.message.delta`, `thread.run.step.completed`, `thread.run.completed`.

- [ ] **Step 3: Implement Assistant & Thread Routes**
  - Full CRUD on `/v1/assistants`.
  - Full CRUD on `/v1/threads` and `/v1/threads/:id/messages`.
  - `POST /v1/threads/:id/runs`: Trigger execution (with `stream: true` support).
  - `POST /v1/threads/:id/runs/:run_id/submit_tool_outputs`: Submits tool results and resumes execution.

---

### Task 9: Realtime API Bidirectional WebSocket Bridge (`/v1/realtime`)

**Files:**
- Create: `apps/gateway/src/routes/v1/realtime.ts`
- Modify: `apps/gateway/src/server.ts` (register `@fastify/websocket`)
- Test: `apps/gateway/tests/v1-realtime.test.ts`

- [ ] **Step 1: Install & Configure WebSocket Transport**
  Register `@fastify/websocket` on Fastify server.

- [ ] **Step 2: Implement Realtime Protocol Handler**
  `apps/gateway/src/routes/v1/realtime.ts`:
  - Route: `GET /v1/realtime` (WebSocket upgrade with `Authorization: Bearer sk-gw-...`).
  - Supports standard client events:
    - `session.update`: Configure modalities (`["text", "audio"]`), voice, VAD settings.
    - `input_audio_buffer.append`: Streams binary PCM/base64 client audio chunks.
    - `input_audio_buffer.commit`: Flushes input turn.
    - `response.create`: Triggers assistant turn.
  - Emits standard server events:
    - `session.created`, `session.updated`.
    - `response.audio.delta`: Streams progressive audio binary tokens.
    - `response.audio_transcript.delta`: Streams live text transcript.
    - `response.done`.
  - Connects to upstream Realtime provider (OpenAI Realtime or Gemini Live audio bridge).

- [ ] **Step 3: Verify and Test**
  Test connection, audio chunk dispatch, and clean session termination.

---

### Task 10: Admin Governance, Fine-Tuning & Webhooks

**Files:**
- Create: `apps/gateway/src/routes/v1/fine-tuning.ts`
- Create: `apps/gateway/src/routes/v1/admin-orgs.ts`
- Modify: `apps/gateway/src/routes/v1/webhooks.ts`
- Test: `apps/gateway/tests/v1-governance.test.ts`

- [ ] **Step 1: Fine-Tuning Routes**
  `/v1/fine_tuning/jobs`: List, create, retrieve, cancel fine-tuning jobs.

- [ ] **Step 2: Organization & Project Scoping**
  Add multi-tenant project scoping: header `OpenAI-Organization` and `OpenAI-Project` maps directly to rate-limit quotas and telemetry isolation.

- [ ] **Step 3: Webhooks Signing**
  Implement cryptographic HMAC-SHA256 signature generation compatible with `client.webhooks.unwrap()`.

---

### Task 11: End-to-End Verification, Documentation & Examples

**Files:**
- Create: `examples/nodejs/embeddings-demo.ts`
- Create: `examples/nodejs/assistants-v2-demo.ts`
- Create: `examples/nodejs/realtime-demo.ts`
- Modify: `examples/README.md`
- Modify: `README.md`

- [ ] **Step 1: Run complete test suite**
  Execute `pnpm test` across all packages and ensure 100% test pass rate.
- [ ] **Step 2: Verify runnable scripts with official OpenAI SDK**
  Run each example script against the local gateway on port 3000.
- [ ] **Step 3: Update documentation and README.md**
  Document the complete OpenAI SDK parity matrix with compatibility badges.
