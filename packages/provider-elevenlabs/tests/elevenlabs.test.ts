import { describe, it, expect, vi, afterEach } from 'vitest';
import { ElevenLabsAdapter } from '../src/index.js';
import type { ProviderConfig } from '@ai-gateway/core';

describe('ElevenLabsAdapter', () => {
  const adapter = new ElevenLabsAdapter();
  const config: ProviderConfig = {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    adapterType: 'elevenlabs',
    apiKey: 'xi-test-key',
    isEnabled: true,
  };

  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('has correct metadata and capabilities', () => {
    expect(adapter.id).toBe('elevenlabs');
    expect(adapter.defaultBaseUrl).toBe('https://api.elevenlabs.io/v1');
    expect(adapter.supportedCapabilities).toContain('tts');
    expect(adapter.supportedCapabilities).toContain('stt');
  });

  it('lists models and voices', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/models')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [
            { model_id: 'eleven_flash_v2_5', name: 'Eleven Flash v2.5', can_do_text_to_speech: true },
          ],
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ voices: [{ voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' }] }),
      });
    });

    const models = await adapter.listModels(config);
    expect(models.length).toBeGreaterThanOrEqual(1);
    expect(models.some((m) => m.id === 'eleven_flash_v2_5')).toBe(true);
  });

  it('translates OpenAI speech request to ElevenLabs text-to-speech stream', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    }));

    const response = await adapter.synthesizeSpeech!(
      {
        model: 'eleven_flash_v2_5',
        input: 'Hello world',
        voice: '21m00Tcm4TlvDq8ikWAM',
      },
      config
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream?optimize_streaming_latency=3',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'xi-api-key': 'xi-test-key',
        }),
      })
    );
    expect(response.status).toBe(200);
  });

  it('translates OpenAI transcribeAudio to ElevenLabs Scribe STT format', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: 'Transcribed speech text' }),
    } as unknown as Response);

    const formData = new FormData();
    formData.append('file', new Blob(['fake audio'], { type: 'audio/mpeg' }), 'test.mp3');

    const response = await adapter.transcribeAudio!(formData, config);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/speech-to-text',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'xi-api-key': 'xi-test-key',
        }),
      })
    );

    const json = await response.json();
    expect(json.text).toBe('Transcribed speech text');
  });
});
