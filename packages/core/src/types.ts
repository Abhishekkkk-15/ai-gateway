import { z } from 'zod';

export type ModelCapability = 'chat' | 'embeddings' | 'stt' | 'tts' | 'vision' | 'tools';

export interface UnifiedModel {
  id: string;                 // e.g. "llama-3.3-70b-versatile"
  providerId: string;         // e.g. "groq"
  slug: string;               // e.g. "groq/llama-3.3-70b-versatile"
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

export interface GatewayKeyMetadata {
  id: string;
  name: string;
  keyHash: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt?: Date | null;
  expiresAt?: Date | null;
  rateLimitRpm?: number | null;
  isEnabled: boolean;
}

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'developer';
  content: string | unknown[];
  name?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIChatMessage[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  stop?: string | string[];
  tools?: unknown[];
  tool_choice?: unknown;
  response_format?: { type: 'text' | 'json_object' | 'json_schema'; [key: string]: unknown };
  [key: string]: unknown;
}

export interface OpenAISpeechRequest {
  model: string;
  input: string;
  voice: string;
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  speed?: number;
}

export interface OpenAIEmbeddingRequest {
  model: string;
  input: string | string[] | number[] | number[][];
  dimensions?: number;
  encoding_format?: 'float' | 'base64';
  user?: string;
  [key: string]: unknown;
}

export interface OpenAIEmbeddingData {
  object: 'embedding';
  embedding: number[] | string;
  index: number;
}

export interface OpenAIEmbeddingResponse {
  object: 'list';
  data: OpenAIEmbeddingData[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIErrorEnvelope {
  error: {
    message: string;
    type: string;
    param?: string | null;
    code?: string | null;
  };
}

export interface RequestTelemetry {
  id?: string;
  timestamp: Date;
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
