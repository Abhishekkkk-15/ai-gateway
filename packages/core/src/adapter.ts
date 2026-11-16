import type {
  ModelCapability,
  ProviderConfig,
  UnifiedModel,
  OpenAIChatCompletionRequest,
  OpenAISpeechRequest,
  OpenAIEmbeddingRequest,
  OpenAIImageGenerateRequest,
  OpenAIModerationRequest,
} from './types.js';

export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly defaultBaseUrl: string;
  readonly supportedCapabilities: ModelCapability[];

  /** Fetch live available models from provider API or return curated defaults */
  listModels(config: ProviderConfig, signal?: AbortSignal): Promise<Omit<UnifiedModel, 'slug' | 'isEnabled'>[]>;

  /** Standard & SSE Streaming Chat Completions (OpenAI format in -> OpenAI format out) */
  chatCompletions?(
    request: OpenAIChatCompletionRequest,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response>;

  /** Vector Embeddings mapped to POST /v1/embeddings */
  createEmbeddings?(
    request: OpenAIEmbeddingRequest,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response>;

  /** Speech-to-Text mapped to POST /v1/audio/transcriptions */
  transcribeAudio?(
    formData: FormData,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response>;

  /** Speech Translation mapped to POST /v1/audio/translations */
  translateAudio?(
    formData: FormData,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response>;

  /** Text-to-Speech mapped to POST /v1/audio/speech */
  synthesizeSpeech?(
    request: OpenAISpeechRequest,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response>;

  /** Image Generation mapped to POST /v1/images/generations */
  generateImages?(
    request: OpenAIImageGenerateRequest,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response>;

  /** Image Edits mapped to POST /v1/images/edits */
  editImages?(
    formData: FormData,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response>;

  /** Image Variations mapped to POST /v1/images/variations */
  createImageVariations?(
    formData: FormData,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response>;

  /** Content Moderations mapped to POST /v1/moderations */
  createModeration?(
    request: OpenAIModerationRequest,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response>;

  /** Optional real-time WebSocket connection handler for bidirectional streaming */
  streamSpeechWebSocket?(
    ws: unknown,
    config: ProviderConfig,
    params: { voiceId: string; modelId?: string }
  ): Promise<void>;
}
