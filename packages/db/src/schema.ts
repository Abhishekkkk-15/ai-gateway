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
