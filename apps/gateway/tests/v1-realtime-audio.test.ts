import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';
import WebSocket from 'ws';
import { pcm16ToWav, calculatePcm16Rms } from '../src/routes/v1/realtime-audio.js';

describe('Decoupled Realtime Audio WebSockets (STT & TTS)', () => {
  let app: FastifyInstance;
  let port: number;
  const validKey = 'sk-gw-test-valid-key-realtime-audio';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();
    await app.listen({ port: 0 });
    port = (app.server.address() as any).port;

    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-rta-1',
      name: 'Test Realtime Audio Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Audio Utilities', () => {
    it('correctly constructs a 44-byte RIFF/WAVE header for PCM16 audio', () => {
      const fakePcm = Buffer.alloc(3200, 128); // 100ms at 16kHz mono
      const wav = pcm16ToWav(fakePcm, 16000, 1);
      expect(wav.length).toBe(3200 + 44);
      expect(wav.toString('utf8', 0, 4)).toBe('RIFF');
      expect(wav.toString('utf8', 8, 12)).toBe('WAVE');
      expect(wav.toString('utf8', 12, 16)).toBe('fmt ');
      expect(wav.readUInt32LE(24)).toBe(16000);
      expect(wav.readUInt16LE(34)).toBe(16);
      expect(wav.toString('utf8', 36, 40)).toBe('data');
      expect(wav.readUInt32LE(40)).toBe(3200);
    });

    it('calculates RMS energy for audio buffers', () => {
      const silence = Buffer.alloc(100, 0);
      expect(calculatePcm16Rms(silence)).toBe(0);

      const activeAudio = Buffer.alloc(100);
      for (let i = 0; i < 100; i += 2) {
        activeAudio.writeInt16LE(16384, i);
      }
      const rms = calculatePcm16Rms(activeAudio);
      expect(rms).toBeGreaterThan(0.4);
      expect(rms).toBeLessThan(0.6);
    });
  });

  describe('Standalone Realtime STT (/v1/speech-to-text/realtime)', () => {
    it('rejects connection without valid authorization', async () => {
      return new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/speech-to-text/realtime`);
        ws.on('unexpected-response', (_req, res) => {
          expect(res.statusCode).toBe(401);
          ws.terminate();
          resolve();
        });
        ws.on('error', () => {});
      });
    });

    it('connects, receives session_started, sends audio chunks, and receives committed_transcript on commit', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(
          `ws://127.0.0.1:${port}/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&audio_format=pcm_16000`,
          {
            headers: {
              Authorization: `Bearer ${validKey}`,
            },
          }
        );

        let receivedSessionStarted = false;

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());

          if (msg.message_type === 'session_started') {
            receivedSessionStarted = true;
            expect(msg.model_id).toBe('scribe_v2_realtime');
            expect(msg.audio_format).toBe('pcm_16000');

            // Send high-energy audio frame
            const audioFrame = Buffer.alloc(1600);
            for (let i = 0; i < 1600; i += 2) {
              audioFrame.writeInt16LE(18000, i);
            }

            ws.send(
              JSON.stringify({
                message_type: 'input_audio_chunk',
                audio_base_64: audioFrame.toString('base64'),
                commit: false,
              })
            );

            // Send commit signal
            setTimeout(() => {
              ws.send(JSON.stringify({ type: 'commit' }));
            }, 50);
          }

          if (msg.message_type === 'committed_transcript') {
            expect(receivedSessionStarted).toBe(true);
            expect(typeof msg.text).toBe('string');
            expect(msg.text.length).toBeGreaterThan(0);
            ws.close();
            resolve();
          }
        });

        ws.on('error', (err) => {
          reject(err);
        });
      });
    });

    it('connects to alias /v1/audio/transcriptions/realtime using api_key query parameter', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(
          `ws://127.0.0.1:${port}/v1/audio/transcriptions/realtime?api_key=${validKey}`
        );

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.message_type === 'session_started') {
            expect(msg.session_id).toBeDefined();
            ws.close();
            resolve();
          }
        });

        ws.on('error', (err) => {
          reject(err);
        });
      });
    });
  });

  describe('Standalone Stream-Input TTS (/v1/text-to-speech/:voiceId/stream-input)', () => {
    it('rejects connection without valid authorization', async () => {
      return new Promise<void>((resolve) => {
        const ws = new WebSocket(
          `ws://127.0.0.1:${port}/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream-input`
        );
        ws.on('unexpected-response', (_req, res) => {
          expect(res.statusCode).toBe(401);
          ws.terminate();
          resolve();
        });
        ws.on('error', () => {});
      });
    });

    it('connects, streams incremental text tokens, and receives audio chunks + final signal', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(
          `ws://127.0.0.1:${port}/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream-input?model_id=eleven_flash_v2_5`,
          {
            headers: {
              Authorization: `Bearer ${validKey}`,
            },
          }
        );

        let receivedAudioChunk = false;

        ws.on('open', () => {
          // Initialize
          ws.send(JSON.stringify({ text: ' ' }));
          // Stream words
          ws.send(JSON.stringify({ text: 'Hello from ' }));
          ws.send(JSON.stringify({ text: 'standalone stream-input TTS. ' }));
          // End of stream
          ws.send(JSON.stringify({ text: '' }));
        });

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());

          if (msg.audio) {
            receivedAudioChunk = true;
            expect(typeof msg.audio).toBe('string');
            expect(msg.is_final).toBe(false);
          }

          if (msg.is_final === true) {
            expect(receivedAudioChunk).toBe(true);
            ws.close();
            resolve();
          }
        });

        ws.on('error', (err) => {
          reject(err);
        });
      });
    });

    it('connects to alias /v1/audio/speech/stream-input using api_key query parameter', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(
          `ws://127.0.0.1:${port}/v1/audio/speech/stream-input?api_key=${validKey}&voice=21m00Tcm4TlvDq8ikWAM`
        );

        ws.on('open', () => {
          ws.send(JSON.stringify({ text: 'Test alias route.' }));
          ws.send(JSON.stringify({ text: '' }));
        });

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.is_final === true) {
            ws.close();
            resolve();
          }
        });

        ws.on('error', (err) => {
          reject(err);
        });
      });
    });
  });
});
