import type {
  ProviderAdapter,
  ProviderConfig,
  UnifiedModel,
  ModelCapability,
  OpenAISpeechRequest,
} from '@ai-gateway/core';

export class ElevenLabsAdapter implements ProviderAdapter {
  public readonly id = 'elevenlabs';
  public readonly name = 'ElevenLabs';
  public readonly defaultBaseUrl = 'https://api.elevenlabs.io/v1';
  public readonly supportedCapabilities: ModelCapability[] = ['tts', 'stt'];

  private getBaseUrl(config: ProviderConfig): string {
    const raw = config.baseUrl?.trim() || this.defaultBaseUrl;
    return raw.replace(/\/+$/, '');
  }

  async listModels(
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Omit<UnifiedModel, 'slug' | 'isEnabled'>[]> {
    const baseUrl = this.getBaseUrl(config);
    const headers: Record<string, string> = {
      'xi-api-key': config.apiKey,
      ...config.extraHeaders,
    };

    try {
      const [modelsRes, voicesRes] = await Promise.all([
        fetch(`${baseUrl}/models`, { method: 'GET', headers, signal }).catch(() => null),
        fetch(`${baseUrl}/voices`, { method: 'GET', headers, signal }).catch(() => null),
      ]);

      const result: Omit<UnifiedModel, 'slug' | 'isEnabled'>[] = [];

      if (modelsRes && modelsRes.ok) {
        const modelsData = (await modelsRes.json()) as Array<{
          model_id: string;
          name: string;
          can_do_text_to_speech?: boolean;
          can_do_voice_conversion?: boolean;
        }>;

        if (Array.isArray(modelsData)) {
          for (const m of modelsData) {
            const capabilities: ModelCapability[] = [];
            if (m.can_do_text_to_speech) capabilities.push('tts');
            if (m.model_id.includes('scribe')) capabilities.push('stt');
            if (capabilities.length === 0) capabilities.push('tts');

            result.push({
              id: m.model_id,
              providerId: config.id,
              displayName: m.name || m.model_id,
              capabilities,
            });
          }
        }
      }

      // Add voice identifiers as virtual model alias choices or curated models if empty
      if (result.length === 0) {
        return this.getCuratedDefaults(config.id);
      }

      // Also ensure scribe_v1 is listed for STT
      if (!result.some((m) => m.id === 'scribe_v1')) {
        result.push({
          id: 'scribe_v1',
          providerId: config.id,
          displayName: 'ElevenLabs Scribe v1',
          capabilities: ['stt'],
        });
      }

      return result;
    } catch {
      return this.getCuratedDefaults(config.id);
    }
  }

  private getCuratedDefaults(providerId: string): Omit<UnifiedModel, 'slug' | 'isEnabled'>[] {
    return [
      {
        id: 'eleven_flash_v2_5',
        providerId,
        displayName: 'Eleven Flash v2.5',
        capabilities: ['tts'],
      },
      {
        id: 'eleven_multilingual_v2',
        providerId,
        displayName: 'Eleven Multilingual v2',
        capabilities: ['tts'],
      },
      {
        id: 'scribe_v1',
        providerId,
        displayName: 'ElevenLabs Scribe v1',
        capabilities: ['stt'],
      },
    ];
  }

  async synthesizeSpeech(
    request: OpenAISpeechRequest,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response> {
    const baseUrl = this.getBaseUrl(config);
    // Voice ID can be passed in request.voice, or fallback to standard Rachel voice ID
    const voiceId = request.voice || '21m00Tcm4TlvDq8ikWAM';
    const streamUrl = `${baseUrl}/text-to-speech/${voiceId}/stream?optimize_streaming_latency=3`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'xi-api-key': config.apiKey,
      ...config.extraHeaders,
    };

    const payload = {
      text: request.input,
      model_id: request.model || 'eleven_flash_v2_5',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
      },
    };

    const response = await fetch(streamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
      duplex: 'half',
    } as RequestInit);

    return response;
  }

  async transcribeAudio(
    formData: FormData,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<Response> {
    const baseUrl = this.getBaseUrl(config);
    const headers: Record<string, string> = {
      'xi-api-key': config.apiKey,
      ...config.extraHeaders,
    };

    // ElevenLabs speech-to-text API: POST /v1/speech-to-text
    const response = await fetch(`${baseUrl}/speech-to-text`, {
      method: 'POST',
      headers,
      body: formData,
      signal,
      duplex: 'half',
    } as RequestInit);

    if (!response.ok) {
      return response;
    }

    const data = (await response.json()) as { text?: string };
    const openAIFormat = {
      text: data.text || '',
    };

    return new Response(JSON.stringify(openAIFormat), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async streamSpeechWebSocket(
    ws: unknown,
    config: ProviderConfig,
    params: { voiceId: string; modelId?: string }
  ): Promise<void> {
    // WebSocket streaming helper hook
    const voiceId = params.voiceId || '21m00Tcm4TlvDq8ikWAM';
    const modelId = params.modelId || 'eleven_flash_v2_5';
    // wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?model_id={model_id}
  }
}
