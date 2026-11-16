import { neon } from '@neondatabase/serverless';

/**
 * Initializes required tables directly via SQL if they do not exist.
 * This guarantees Neon Postgres has the correct schema even before or without external migrations.
 */
export async function initializeSchema(connectionString: string): Promise<void> {
  const sql = neon(connectionString);

  await sql`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      adapter_type TEXT NOT NULL,
      base_url TEXT,
      encrypted_api_key TEXT NOT NULL,
      extra_headers JSONB,
      custom_options JSONB,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS models (
      slug TEXT PRIMARY KEY,
      model_id TEXT NOT NULL,
      provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      capabilities JSONB NOT NULL,
      context_window INTEGER,
      custom_alias TEXT UNIQUE,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS gateway_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      prefix TEXT NOT NULL,
      rate_limit_rpm INTEGER,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      last_used_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS request_logs (
      id TEXT PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      model_slug TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      gateway_key_id TEXT,
      status_code INTEGER NOT NULL,
      is_streaming BOOLEAN NOT NULL DEFAULT FALSE,
      ttft_ms INTEGER,
      latency_ms INTEGER NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      error_message TEXT
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
}
