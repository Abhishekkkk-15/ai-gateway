import { pgTable, text, boolean, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import type { ModelCapability } from '@ai-gateway/core';

export const providersTable = pgTable('providers', {
  id: text('id').primaryKey(), // e.g. 'groq', 'nvidia', 'custom-deepseek'
  name: text('name').notNull(),
  adapterType: text('adapter_type').notNull(), // 'groq', 'nvidia', 'google', 'elevenlabs', 'openai-compatible'
  baseUrl: text('base_url'),
  encryptedApiKey: text('encrypted_api_key').notNull(),
  extraHeaders: jsonb('extra_headers').$type<Record<string, string>>(),
  customOptions: jsonb('custom_options').$type<Record<string, unknown>>(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const modelsTable = pgTable('models', {
  slug: text('slug').primaryKey(), // e.g. 'groq/llama-3.3-70b-versatile'
  modelId: text('model_id').notNull(), // e.g. 'llama-3.3-70b-versatile'
  providerId: text('provider_id')
    .notNull()
    .references(() => providersTable.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  capabilities: jsonb('capabilities').$type<ModelCapability[]>().notNull(),
  contextWindow: integer('context_window'),
  customAlias: text('custom_alias').unique(), // e.g. 'fast-chat'
  isEnabled: boolean('is_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gatewayKeysTable = pgTable('gateway_keys', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(), // SHA-256
  prefix: text('prefix').notNull(), // e.g. 'sk-gw-1234'
  rateLimitRpm: integer('rate_limit_rpm'),
  isEnabled: boolean('is_enabled').notNull().default(true),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const requestLogsTable = pgTable('request_logs', {
  id: text('id').primaryKey(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  modelSlug: text('model_slug').notNull(),
  providerId: text('provider_id').notNull(),
  gatewayKeyId: text('gateway_key_id'),
  statusCode: integer('status_code').notNull(),
  isStreaming: boolean('is_streaming').notNull().default(false),
  ttftMs: integer('ttft_ms'),
  latencyMs: integer('latency_ms').notNull(),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  errorMessage: text('error_message'),
});

export const adminUsersTable = pgTable('admin_users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const filesTable = pgTable('files', {
  id: text('id').primaryKey(), // e.g. 'file-abc123xyz'
  bytes: integer('bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  filename: text('filename').notNull(),
  purpose: text('purpose').notNull(), // 'assistants', 'batch', 'fine-tune', 'vision', etc.
  storagePath: text('storage_path').notNull(),
  mimeType: text('mime_type').default('application/octet-stream').notNull(),
  status: text('status').default('processed').notNull(), // 'uploaded' | 'processed' | 'error'
  statusDetails: text('status_details'),
});

export const uploadsTable = pgTable('uploads', {
  id: text('id').primaryKey(), // e.g. 'upload_abc123'
  bytes: integer('bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  filename: text('filename').notNull(),
  purpose: text('purpose').notNull(),
  mimeType: text('mime_type').default('application/octet-stream').notNull(),
  status: text('status').default('pending').notNull(), // 'pending' | 'completed' | 'cancelled'
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const uploadPartsTable = pgTable('upload_parts', {
  id: text('id').primaryKey(), // e.g. 'part_abc123'
  uploadId: text('upload_id')
    .notNull()
    .references(() => uploadsTable.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const batchesTable = pgTable('batches', {
  id: text('id').primaryKey(), // e.g. 'batch_abc123'
  endpoint: text('endpoint').notNull(), // '/v1/chat/completions' | '/v1/embeddings'
  inputFileId: text('input_file_id').notNull(),
  outputFileId: text('output_file_id'),
  errorFileId: text('error_file_id'),
  completionWindow: text('completion_window').notNull().default('24h'),
  status: text('status').notNull().default('validating'), // 'validating' | 'in_progress' | 'completed' | 'failed' | 'expired' | 'cancelling' | 'cancelled'
  requestCounts: jsonb('request_counts').$type<{ total: number; completed: number; failed: number }>().notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  inProgressAt: timestamp('in_progress_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export const vectorStoresTable = pgTable('vector_stores', {
  id: text('id').primaryKey(), // e.g. 'vs_abc123'
  name: text('name').notNull(),
  bytes: integer('bytes').notNull().default(0),
  status: text('status').notNull().default('completed'), // 'completed' | 'in_progress' | 'expired'
  fileCounts: jsonb('file_counts').$type<{ in_progress: number; completed: number; failed: number; cancelled: number; total: number }>().notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export const vectorStoreFilesTable = pgTable('vector_store_files', {
  id: text('id').primaryKey(), // matches file_id
  vectorStoreId: text('vector_store_id')
    .notNull()
    .references(() => vectorStoresTable.id, { onDelete: 'cascade' }),
  usageBytes: integer('usage_bytes').notNull().default(0),
  status: text('status').notNull().default('completed'), // 'in_progress' | 'completed' | 'cancelled' | 'failed'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ProviderRow = typeof providersTable.$inferSelect;
export type InsertProviderRow = typeof providersTable.$inferInsert;
export type ModelRow = typeof modelsTable.$inferSelect;
export type InsertModelRow = typeof modelsTable.$inferInsert;
export type GatewayKeyRow = typeof gatewayKeysTable.$inferSelect;
export type InsertGatewayKeyRow = typeof gatewayKeysTable.$inferInsert;
export type RequestLogRow = typeof requestLogsTable.$inferSelect;
export type InsertRequestLogRow = typeof requestLogsTable.$inferInsert;
export type AdminUserRow = typeof adminUsersTable.$inferSelect;
export type InsertAdminUserRow = typeof adminUsersTable.$inferInsert;
export type FileRow = typeof filesTable.$inferSelect;
export type InsertFileRow = typeof filesTable.$inferInsert;
export type UploadRow = typeof uploadsTable.$inferSelect;
export type InsertUploadRow = typeof uploadsTable.$inferInsert;
export type UploadPartRow = typeof uploadPartsTable.$inferSelect;
export type InsertUploadPartRow = typeof uploadPartsTable.$inferInsert;
export type BatchRow = typeof batchesTable.$inferSelect;
export type InsertBatchRow = typeof batchesTable.$inferInsert;
export type VectorStoreRow = typeof vectorStoresTable.$inferSelect;
export type InsertVectorStoreRow = typeof vectorStoresTable.$inferInsert;
export type VectorStoreFileRow = typeof vectorStoreFilesTable.$inferSelect;
export type InsertVectorStoreFileRow = typeof vectorStoreFilesTable.$inferInsert;
