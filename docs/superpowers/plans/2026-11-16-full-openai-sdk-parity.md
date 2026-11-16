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
 Phase 5: Next-Generation Responses API & Conversations (/v1/responses, /v1/conversations)
 Phase 6: Assistants v2 & Stateful Agent Engine (Threads, Messages, Runs, Tool Output Submission)
 Phase 7: Realtime API (Bidirectional Audio/Text WebSockets Bridge)
 Phase 8: Verification, Examples & Admin Console Integration
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

- [x] **Step 1: Write the failing test**
  Create `apps/gateway/tests/v1-embeddings.test.ts` testing:
  - Single string input: `{ model: "text-embedding-3-small", input: "Hello world" }`
  - Array of strings input: `{ model: "text-embedding-3-small", input: ["Doc 1", "Doc 2"] }`
  - Truncated Matryoshka dimensions: `{ model: "text-embedding-3-large", input: "test", dimensions: 512 }`
  - Base64 encoding format: `{ encoding_format: "base64" }`
  - OpenAI response envelope verification: `{ object: "list", data: [{ object: "embedding", embedding: [...], index: 0 }], model: "...", usage: { prompt_tokens: 2, total_tokens: 2 } }`.

- [x] **Step 2: Define Adapter Contract & Types**
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

- [x] **Step 3: Implement Upstream Adapters**
  - Implement `createEmbeddings` in `generic-openai.ts` mapping to `${baseUrl}/embeddings`.
  - Implement `createEmbeddings` in `packages/provider-nvidia/src/index.ts` routing to Nvidia NeMo Embedding models (e.g. `nvidia/nv-embedqa-e5-v5`).

- [x] **Step 4: Implement Fastify Route & In-Memory Route Resolution**
  Create `apps/gateway/src/routes/v1/embeddings.ts`:
  - Enforce `authenticateGatewayKey`.
  - Lookup model via zero-DB `fastify.routingCache.resolveModel(body.model)`.
  - Validate model has `capabilities: ['embeddings']`.
  - Execute adapter and return JSON response.
  - Asynchronously record request telemetry log to DB without blocking response.

- [x] **Step 5: Run tests and verify**
  Run `pnpm --filter @ai-gateway/gateway test` and confirm `v1-embeddings.test.ts` passes.

---

### Task 2: Audio Translation Endpoint (`POST /v1/audio/translations`)

**Files:**
- Modify: `packages/core/src/adapter.ts:40-60`
- Modify: `packages/core/src/adapters/generic-openai.ts:130-160`
- Modify: `packages/provider-groq/src/index.ts:70-95`
- Modify: `apps/gateway/src/routes/v1/audio.ts:80-140`
- Test: `apps/gateway/tests/v1-audio-translations.test.ts`

- [x] **Step 1: Write the failing test**
  Create `apps/gateway/tests/v1-audio-translations.test.ts` testing:
  - `POST /v1/audio/translations` with multipart form-data `file` (foreign language audio) and `model: "whisper-large-v3-turbo"`.
  - Formats: JSON (`{ text: "English translation..." }`), verbose_json, srt, vtt.

- [x] **Step 2: Add Adapter Translation Contract**
  Add `translateAudio?(formData: FormData, config: ProviderConfig, signal?: AbortSignal): Promise<Response>` to `ProviderAdapter`.

- [x] **Step 3: Implement Fastify Route**
  In `apps/gateway/src/routes/v1/audio.ts`, register `POST /v1/audio/translations`:
  - Consume streaming multipart form-data via `@fastify/multipart`.
  - Route to Whisper-capable provider (Groq or OpenAI).
  - Forward translation result in requested format.

- [x] **Step 4: Run tests and commit**
  Confirm test passes; commit as `feat(gateway): add /v1/audio/translations route`.

---

### Task 3: Images API (`POST /v1/images/generations`, `edits`, `variations`)

**Files:**
- Create: `apps/gateway/src/routes/v1/images.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/adapter.ts`
- Modify: `packages/core/src/adapters/generic-openai.ts`
- Modify: `apps/gateway/src/server.ts`
- Test: `apps/gateway/tests/v1-images.test.ts`
- Examples: `examples/nodejs/images-demo.ts`, `examples/python/images_demo.py`

- [x] **Step 1: Write the failing test**
  Create `apps/gateway/tests/v1-images.test.ts` testing:
  - `POST /v1/images/generations`: `{ prompt: "cyberpunk city", model: "dall-e-3", n: 1, size: "1024x1024", response_format: "url" }`.
  - Verify OpenAI response structure: `{ created: 1710000000, data: [{ url: "https://...", revised_prompt: "..." }] }`.
  - Base64 format: `{ response_format: "b64_json" }` -> `{ data: [{ b64_json: "..." }] }`.
  - `POST /v1/images/edits` (multipart with image, mask, prompt).
  - `POST /v1/images/variations` (multipart with image).

- [x] **Step 2: Implement Image Generation Adapter & Routing**
  - Implement image contract supporting DALL-E, Stability AI, and FLUX (Black Forest Labs via Together/Replicate/OpenAI-compatible).
  - Add `generateImages`, `editImages`, `createImageVariations` to `packages/core/src/adapter.ts`.

- [x] **Step 3: Register Fastify Routes**
  In `apps/gateway/src/routes/v1/images.ts`, register `/v1/images/generations`, `/v1/images/edits`, and `/v1/images/variations`.

- [x] **Step 4: Run tests and verify**
  Run `pnpm test` and ensure all image tests pass.

---

### Task 4: Content Moderation Endpoint (`POST /v1/moderations`)

**Files:**
- Create: `apps/gateway/src/routes/v1/moderations.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/adapter.ts`
- Modify: `packages/core/src/adapters/generic-openai.ts`
- Modify: `apps/gateway/src/server.ts`
- Test: `apps/gateway/tests/v1-moderations.test.ts`
- Examples: `examples/nodejs/moderations-demo.ts`, `examples/python/moderations_demo.py`

- [x] **Step 1: Write the failing test**
  Create `apps/gateway/tests/v1-moderations.test.ts` testing:
  - Input: `{ input: "Sample benign text" }`
  - Output envelope: `{ id: "modr-...", model: "omni-moderation-latest", results: [{ flagged: false, categories: { hate: false, harassment: false, ... }, category_scores: { hate: 0.001, ... } }] }`.
  - Flagged input behavior with policy categories.

- [x] **Step 2: Implement Adapter & Moderation Normalization**
  - Connect to upstream moderation (OpenAI moderation or Nvidia `meta/llama-guard-4-12b` classification adapter).
  - Normalize classifications to standard OpenAI category dictionary (`hate`, `hate/threatening`, `harassment`, `self-harm`, `sexual`, `sexual/minors`, `violence`, `violence/graphic`).

- [x] **Step 3: Register Fastify Route**
  Register `POST /v1/moderations` in `apps/gateway/src/routes/v1/moderations.ts`.

---

### Task 5: Persistent Files API (`/v1/files`) & Multipart Chunked Uploads (`/v1/uploads`)

**Files:**
- Create: `apps/gateway/src/services/storage.ts`
- Create: `apps/gateway/src/routes/v1/files.ts`
- Create: `apps/gateway/src/routes/v1/uploads.ts`
- Modify: `packages/db/src/schema.ts`
- Modify: `apps/gateway/src/server.ts`
- Test: `apps/gateway/tests/v1-files.test.ts`
- Examples: `examples/nodejs/files-demo.ts`, `examples/python/files_demo.py`

- [x] **Step 1: Design DB Schema for Files & Uploads**
  In `packages/db/src/schema.ts`:
  - `filesTable`: `id`, `bytes`, `createdAt`, `filename`, `purpose`, `storagePath`, `mimeType`, `status`.
  - `uploadsTable` and `uploadPartsTable` for resumable multipart uploads.

- [x] **Step 2: Implement Storage Service Abstraction**
  `apps/gateway/src/services/storage.ts`: Supports local disk storage with in-memory test fallback and database persistence.
  Methods: `saveFile`, `listFiles`, `getFile`, `getFileContent`, `deleteFile`, `createUpload`, `addUploadPart`, `completeUpload`, `cancelUpload`.

- [x] **Step 3: Implement `/v1/files` Routes**
  - `POST /v1/files`: Multipart upload (returns `FileObject`).
  - `GET /v1/files`: Lists files filtered by `purpose` (`{ object: 'list', data: [...] }`).
  - `GET /v1/files/:file_id`: Returns metadata.
  - `GET /v1/files/:file_id/content`: Streams binary file bytes.
  - `DELETE /v1/files/:file_id`: Revokes and deletes from storage.

- [x] **Step 4: Implement `/v1/uploads` Routes**
  - `POST /v1/uploads`: Initializes a multi-part upload session (`bytes`, `filename`, `purpose`).
  - `POST /v1/uploads/:upload_id/parts`: Appends chunk part (`part_id`).
  - `POST /v1/uploads/:upload_id/complete`: Stitches parts and creates final `file-` entry.
  - `POST /v1/uploads/:upload_id/cancel`: Cancels upload session.

- [x] **Step 5: Run tests and commit**
  Verify complete file lifecycle via `v1-files.test.ts`.

---

### Task 6: Asynchronous Batches API (`POST /v1/batches`)

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `apps/gateway/src/services/batch-processor.ts`
- Create: `apps/gateway/src/routes/v1/batches.ts`
- Modify: `apps/gateway/src/server.ts`
- Test: `apps/gateway/tests/v1-batches.test.ts`
- Examples: `examples/nodejs/batches-demo.ts`, `examples/python/batches_demo.py`

- [x] **Step 1: Design DB Schema for Batches**
  In `packages/db/src/schema.ts`:
  - `batchesTable`: `id`, `endpoint`, `inputFileId`, `outputFileId`, `errorFileId`, `status`, `requestCounts`, `metadata`.

- [x] **Step 2: Build Asynchronous Batch Processing Engine**
  `apps/gateway/src/services/batch-processor.ts`:
  - Streams `inputFileId` line by line (each containing `custom_id`, `method`, `url`, `body`).
  - Executes batch and writes to output file in storage.
  - Automatically updates batch progress and sets `status = 'completed'`.

- [x] **Step 3: Implement Fastify Batch Routes**
  - `POST /v1/batches`: Initiates batch job.
  - `GET /v1/batches/:batch_id`: Returns batch status and request counts.
  - `POST /v1/batches/:batch_id/cancel`: Gracefully halts in-progress batch.
  - `GET /v1/batches`: Cursor-paginated listing.

- [x] **Step 4: Run tests and verify**
  Run `v1-batches.test.ts` and confirm batch execution.

---

### Task 7: Vector Stores API (`/v1/vector_stores`)

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `apps/gateway/src/services/vector-store.ts`
- Create: `apps/gateway/src/routes/v1/vector-stores.ts`
- Modify: `apps/gateway/src/server.ts`
- Test: `apps/gateway/tests/v1-vector-stores.test.ts`
- Examples: `examples/nodejs/vector-stores-demo.ts`, `examples/python/vector_stores_demo.py`

- [x] **Step 1: DB Schema for Vector Stores & Files**
  In `packages/db/src/schema.ts`:
  - `vectorStoresTable`: `id`, `name`, `bytes`, `status`, `fileCounts`, `metadata`, `createdAt`, `lastActiveAt`, `expiresAt`.
  - `vectorStoreFilesTable`: `id`, `vectorStoreId`, `usageBytes`, `status`, `createdAt`.

- [x] **Step 2: Vector Store Service Abstraction**
  `apps/gateway/src/services/vector-store.ts`:
  - Manages vector stores, file attachments, and file batches.
  - Supports in-memory test fallback and database persistence.

- [x] **Step 3: Implement `/v1/vector_stores` Routes**
  - `POST /v1/vector_stores`: Create vector store.
  - `GET /v1/vector_stores`: List vector stores.
  - `GET /v1/vector_stores/:id`: Retrieve details.
  - `POST /v1/vector_stores/:id`: Update metadata/name.
  - `DELETE /v1/vector_stores/:id`: Purge store.
  - `POST /v1/vector_stores/:id/files`: Associate uploaded file.
  - `GET /v1/vector_stores/:id/files`: List files in store.
  - `DELETE /v1/vector_stores/:id/files/:file_id`: Remove file.
  - `POST /v1/vector_stores/:id/file_batches`: Batch attach files.
  - `GET /v1/vector_stores/:id/file_batches/:batch_id`: Retrieve batch status.

- [x] **Step 4: Run tests and verify**
  Run `v1-vector-stores.test.ts` and confirm vector stores functionality.

---

### Task 8: Next-Generation Responses API & Conversations (`POST /v1/responses`, `/v1/conversations`)

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `apps/gateway/src/services/responses-engine.ts`
- Create: `apps/gateway/src/routes/v1/responses.ts`
- Create: `apps/gateway/src/routes/v1/conversations.ts`
- Modify: `apps/gateway/src/server.ts`
- Test: `apps/gateway/tests/v1-responses.test.ts`
- Examples: `examples/nodejs/responses-demo.ts`, `examples/python/responses_demo.py`

- [x] **Step 1: Write the failing test**
  Create `apps/gateway/tests/v1-responses.test.ts` testing:
  - `POST /v1/responses` with simple input: `{ model: "gpt-4o", input: "Say hello!" }`
  - Verify envelope: `{ id: "resp_...", object: "response", status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "..." }] }], output_text: "...", usage: { total_tokens: 10 } }`.
  - Multi-turn chained responses via `previous_response_id: "resp_123"` or `conversation: "conv_123"`.
  - SSE streaming mode (`stream: true`): emitting `response.created`, `response.output_text.delta`, and `response.completed`.

- [x] **Step 2: Conversation & Response DB Schema**
  In `packages/db/src/schema.ts`:
  - `conversationsTable`: `id`, `metadata`, `createdAt`.
  - `conversationItemsTable`: `id`, `conversationId`, `role`, `content`, `createdAt`.
  - `responsesTable`: `id`, `conversationId`, `model`, `status`, `outputText`, `usage`, `createdAt`.

- [x] **Step 3: Implement Responses Translation & Execution Engine**
  `apps/gateway/src/services/responses-engine.ts`:
  - Normalizes `input` (string or array of items).
  - Handles conversation context: automatically restores previous turns from `conversation` or `previous_response_id`.
  - Automatically synthesizes the convenient `output_text` helper accessor and output item lists.
  - Transforms upstream SSE streaming events into native Next-Gen responses protocol events.

- [x] **Step 4: Implement Fastify Routes**
  - In `apps/gateway/src/routes/v1/responses.ts`: `POST /v1/responses`, `GET /v1/responses/:id`, `DELETE /v1/responses/:id`.
  - In `apps/gateway/src/routes/v1/conversations.ts`: `POST /v1/conversations`, `GET /v1/conversations/:id`, `DELETE /v1/conversations/:id`, `POST /v1/conversations/:id/items`.

- [x] **Step 5: Run tests and verify**
  Run `v1-responses.test.ts` and confirm Responses API parity.

---

### Task 9: Assistants v2 & Stateful Agent Engine (`/v1/assistants`, `/v1/threads`, `/v1/runs`)

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `apps/gateway/src/services/assistant-runner.ts`
- Create: `apps/gateway/src/routes/v1/assistants.ts`
- Create: `apps/gateway/src/routes/v1/threads.ts`
- Modify: `apps/gateway/src/server.ts`
- Test: `apps/gateway/tests/v1-assistants.test.ts`
- Examples: `examples/nodejs/assistants-v2-demo.ts`, `examples/python/assistants_v2_demo.py`

- [x] **Step 1: DB Schema for Assistants, Threads, Messages & Runs**
  In `packages/db/src/schema.ts`:
  - `assistantsTable`: `id`, `name`, `model`, `instructions`, `tools`, `toolResources`, `metadata`.
  - `threadsTable`: `id`, `metadata`.
  - `threadMessagesTable`: `id`, `threadId`, `role`, `content`.
  - `runsTable`: `id`, `threadId`, `assistantId`, `status`, `instructions`, `tools`, `usage`.

- [x] **Step 2: Execution State Machine & Runner Engine**
  `apps/gateway/src/services/assistant-runner.ts`:
  - Resolves conversation history from `threads` and `messages`.
  - Executes tool calling loop and model invocations.
  - Automatically appends assistant messages to thread upon completion.

- [x] **Step 3: Implement Assistant & Thread Routes**
  - Full CRUD on `/v1/assistants`.
  - Full CRUD on `/v1/threads` and `/v1/threads/:id/messages`.
  - `POST /v1/threads/:id/runs`: Trigger execution.

- [x] **Step 4: Run tests and verify**
  Run `v1-assistants.test.ts` and confirm agent parity.

---

### Task 10: Realtime API Bidirectional WebSocket Bridge (`/v1/realtime`)

**Files:**
- Create: `apps/gateway/src/routes/v1/realtime.ts`
- Modify: `apps/gateway/src/server.ts` (registered `@fastify/websocket`)
- Test: `apps/gateway/tests/v1-realtime.test.ts`
- Examples: `examples/nodejs/realtime-demo.ts`, `examples/python/realtime_demo.py`

- [x] **Step 1: Install & Configure WebSocket Transport**
  Registered `@fastify/websocket` on Fastify server.

- [x] **Step 2: Implement Realtime Protocol Handler**
  `apps/gateway/src/routes/v1/realtime.ts`:
  - Route: `GET /v1/realtime` (WebSocket upgrade with `Authorization: Bearer sk-gw-...`).
  - Emits `session.created`, `session.updated`.
  - Handles client `session.update`, `response.create`.
  - Emits `response.created`, `response.output_item.added`, `response.content_part.added`, `response.output_item.done`, `response.done`.

- [x] **Step 3: Verify and Test**
  Test connection, unauthorized rejection, and session turns via `v1-realtime.test.ts`.

---

### Task 11: Admin Governance, Fine-Tuning & Webhooks

**Files:**
- Create: `apps/gateway/src/routes/v1/fine-tuning.ts`
- Create: `apps/gateway/src/routes/v1/webhooks.ts`
- Modify: `apps/gateway/src/server.ts`
- Test: `apps/gateway/tests/v1-governance.test.ts`
- Examples: `examples/nodejs/fine-tuning-demo.ts`, `examples/python/fine_tuning_demo.py`

- [x] **Step 1: Fine-Tuning Routes**
  `/v1/fine_tuning/jobs`: List, create, retrieve, cancel fine-tuning jobs.

- [x] **Step 2: Organization & Project Scoping**
  Multi-tenant project scoping: header `OpenAI-Organization` and `OpenAI-Project`.

- [x] **Step 3: Webhooks Signing & Verification**
  Implemented cryptographic HMAC-SHA256 signature verification compatible with `client.webhooks.unwrap()`.

---

### Task 12: End-to-End Verification, Documentation & Examples

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
