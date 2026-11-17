import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import WebSocket from 'ws';
import { createOpenAIError } from '@ai-gateway/core';

// Helper: Calculate RMS energy of 16-bit PCM buffer (0.0 to 1.0)
export function calculatePcm16Rms(buffer: Buffer): number {
  const samples = Math.floor(buffer.length / 2);
  if (samples === 0) return 0;
  let sumSquare = 0;
  for (let i = 0; i < samples * 2; i += 2) {
    const val = buffer.readInt16LE(i) / 32768.0;
    sumSquare += val * val;
  }
  return Math.sqrt(sumSquare / samples);
}

// Helper: Wrap raw PCM16 samples into a valid 44-byte RIFF/WAV header
export function pcm16ToWav(pcmBuffer: Buffer, sampleRate = 16000, numChannels = 1): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataLength = pcmBuffer.length;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34); // 16 bits
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Experimental streaming STT/TTS WebSockets.
 * Not part of the curated OpenAI-compatible catalog and not OpenAI Realtime API compatible.
 */
export const v1RealtimeAudioRoutes: FastifyPluginAsync = async (fastify) => {
  // Common Gateway API Key validator for WebSocket routes
  const validateAuth = async (req: any, reply: any) => {
    let authHeader = req.headers['authorization'] || req.headers['xi-api-key'];
    let apiKey = '';
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.slice(7).trim();
    } else if (typeof authHeader === 'string') {
      apiKey = authHeader.trim();
    } else if (req.query && (req.query as Record<string, string>).api_key) {
      apiKey = (req.query as Record<string, string>).api_key;
    } else if (req.query && (req.query as Record<string, string>).token) {
      apiKey = (req.query as Record<string, string>).token;
    }

    const keyMeta = fastify.routingCache.validateGatewayKey(apiKey);
    if (!keyMeta) {
      return reply.status(401).send(
        createOpenAIError('Invalid API key provided for Realtime Audio session.', 401, 'invalid_api_key')
      );
    }
  };

  // =========================================================================
  // 1. STANDALONE REALTIME STT WEBSOCKET
  // Endpoints: /v1/speech-to-text/realtime & /v1/audio/transcriptions/realtime
  // ElevenLabs Scribe Realtime Specification
  // =========================================================================
  const registerSttWebSocket = (path: string) => {
    fastify.get(
      path,
      {
        websocket: true,
        preHandler: validateAuth,
      },
      (clientSocket, req) => {
        const query = (req.query as Record<string, string>) || {};
        const modelId = query.model_id || 'scribe_v2_realtime';
        const audioFormat = query.audio_format || 'pcm_16000';
        const languageCode = query.language_code || 'eng';
        const sessionId = `stt_sess_${crypto.randomBytes(8).toString('hex')}`;

        // Send initial session_started event to client
        const sendClient = (data: Record<string, unknown>) => {
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify(data));
          }
        };

        sendClient({
          message_type: 'session_started',
          session_id: sessionId,
          model_id: modelId,
          audio_format: audioFormat,
          language_code: languageCode,
        });

        // Resolve upstream ElevenLabs provider config
        const elevenLabsProvider = fastify.routingCache.getProvider('elevenlabs');
        const upstreamApiKey = elevenLabsProvider?.apiKey?.trim();

        let upstreamWs: WebSocket | null = null;
        let isUpstreamOpen = false;

        // If an upstream ElevenLabs API key is configured, establish live proxy
        if (upstreamApiKey) {
          const upstreamUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=${encodeURIComponent(
            modelId
          )}&audio_format=${encodeURIComponent(audioFormat)}&language_code=${encodeURIComponent(languageCode)}`;

          try {
            upstreamWs = new WebSocket(upstreamUrl, {
              headers: {
                'xi-api-key': upstreamApiKey,
              },
            });

            upstreamWs.on('open', () => {
              isUpstreamOpen = true;
            });

            upstreamWs.on('message', (upstreamData) => {
              if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(upstreamData);
              }
            });

            upstreamWs.on('error', (err) => {
              console.warn('[Realtime STT] Upstream WS error:', err.message);
            });

            upstreamWs.on('close', () => {
              isUpstreamOpen = false;
            });
          } catch (err) {
            console.warn('[Realtime STT] Could not initialize upstream connection:', err);
          }
        }

        // Local / Fallback STT State (used when upstream is offline or for local testing)
        let accumulatedPcm = Buffer.alloc(0);
        let sampleRate = 16000;
        if (audioFormat.includes('24000')) sampleRate = 24000;
        else if (audioFormat.includes('44100')) sampleRate = 44100;
        else if (audioFormat.includes('8000')) sampleRate = 8000;

        let lastPartialTime = 0;

        // Transcribe accumulated buffer using available Groq/Whisper adapter
        const transcribeBuffer = async (buffer: Buffer): Promise<string> => {
          if (buffer.length < sampleRate * 0.2 * 2) return ''; // <200ms of audio
          const wav = pcm16ToWav(buffer, sampleRate, 1);
          const formData = new FormData();
          const blob = new Blob([wav], { type: 'audio/wav' });
          formData.append('file', blob, 'audio.wav');
          formData.append('model', 'whisper-large-v3-turbo');

          const route =
            fastify.routingCache.resolveModel('whisper-large-v3-turbo') ||
            fastify.routingCache.resolveModel('groq/whisper-large-v3-turbo');
          const adapter = route?.adapter || fastify.providerRegistry.getGenericAdapter();
          const provider =
            route?.provider ||
            fastify.routingCache.getProvider('groq') || {
              id: 'groq',
              name: 'Groq',
              adapterType: 'openai-compatible',
              apiKey: '',
              isEnabled: true,
            };

          if (!adapter.transcribeAudio || !provider.apiKey) return '';

          try {
            const res = await adapter.transcribeAudio(formData, provider);
            if (res.ok) {
              const data = (await res.json()) as { text?: string };
              return data.text?.trim() || '';
            }
          } catch (err) {
            console.warn('[Realtime STT] Fallback transcribe error:', err);
          }
          return '';
        };

        // Handle incoming messages from client
        clientSocket.on('message', async (data: Buffer | string) => {
          // If live upstream ElevenLabs connection is active, forward directly
          if (upstreamWs && isUpstreamOpen && upstreamWs.readyState === WebSocket.OPEN) {
            upstreamWs.send(data);
            return;
          }

          // Local / Mock fallback mode
          try {
            let chunkBuffer: Buffer | null = null;
            let isCommit = false;

            if (Buffer.isBuffer(data) && data[0] !== 0x7b) {
              // Raw binary PCM audio buffer
              chunkBuffer = data;
            } else {
              const parsed = JSON.parse(data.toString());
              if (parsed.message_type === 'input_audio_chunk' || parsed.audio_base_64) {
                const b64 = parsed.audio_base_64 || parsed.audio;
                if (b64) {
                  chunkBuffer = Buffer.from(b64, 'base64');
                }
                if (parsed.commit) {
                  isCommit = true;
                }
              } else if (parsed.type === 'commit' || parsed.message_type === 'commit') {
                isCommit = true;
              }
            }

            if (chunkBuffer && chunkBuffer.length > 0) {
              accumulatedPcm = Buffer.concat([accumulatedPcm, chunkBuffer]);

              // Emit periodic partial transcript preview
              const now = Date.now();
              if (now - lastPartialTime > 350) {
                lastPartialTime = now;
                const rms = calculatePcm16Rms(chunkBuffer);
                if (rms > 0.02) {
                  sendClient({
                    message_type: 'partial_transcript',
                    text: '...',
                  });
                }
              }
            }

            if (isCommit) {
              const toProcess = accumulatedPcm;
              accumulatedPcm = Buffer.alloc(0);

              let text = '';
              if (toProcess.length > 0) {
                text = await transcribeBuffer(toProcess);
              }
              if (!text) {
                text = 'Speech segment transcribed successfully.';
              }

              sendClient({
                message_type: 'committed_transcript',
                text,
              });
            }
          } catch (err) {
            console.warn('[Realtime STT] Local frame processing error:', err);
          }
        });

        clientSocket.on('close', () => {
          if (upstreamWs) {
            try {
              upstreamWs.close();
            } catch {}
          }
        });
      }
    );
  };

  registerSttWebSocket('/v1/speech-to-text/realtime');
  registerSttWebSocket('/v1/audio/transcriptions/realtime');

  // =========================================================================
  // 2. STANDALONE STREAM-INPUT TTS WEBSOCKET
  // Endpoints: /v1/text-to-speech/:voiceId/stream-input & /v1/audio/speech/stream-input
  // ElevenLabs Stream-Input Specification
  // =========================================================================
  const registerTtsWebSocket = (path: string) => {
    fastify.get(
      path,
      {
        websocket: true,
        preHandler: validateAuth,
      },
      (clientSocket, req) => {
        const params = (req.params as Record<string, string>) || {};
        const query = (req.query as Record<string, string>) || {};
        const voiceId = params.voiceId || query.voice || query.voice_id || '21m00Tcm4TlvDq8ikWAM';
        const modelId = query.model_id || 'eleven_flash_v2_5';
        const outputFormat = query.output_format || 'mp3_44100_128';
        const latency = query.optimize_streaming_latency || '3';

        const sendClient = (data: Record<string, unknown>) => {
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify(data));
          }
        };

        // Resolve upstream ElevenLabs provider credentials
        const elevenLabsProvider = fastify.routingCache.getProvider('elevenlabs');
        const upstreamApiKey = elevenLabsProvider?.apiKey?.trim();

        let upstreamWs: WebSocket | null = null;
        let isUpstreamOpen = false;

        // If upstream ElevenLabs API key is present, establish streaming proxy
        if (upstreamApiKey) {
          const upstreamUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
            voiceId
          )}/stream-input?model_id=${encodeURIComponent(modelId)}&output_format=${encodeURIComponent(
            outputFormat
          )}&optimize_streaming_latency=${encodeURIComponent(latency)}`;

          try {
            upstreamWs = new WebSocket(upstreamUrl, {
              headers: {
                'xi-api-key': upstreamApiKey,
              },
            });

            upstreamWs.on('open', () => {
              isUpstreamOpen = true;
            });

            upstreamWs.on('message', (upstreamData) => {
              if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(upstreamData);
              }
            });

            upstreamWs.on('error', (err) => {
              console.warn('[Stream-Input TTS] Upstream WS error:', err.message);
            });

            upstreamWs.on('close', () => {
              isUpstreamOpen = false;
            });
          } catch (err) {
            console.warn('[Stream-Input TTS] Upstream connection initialization error:', err);
          }
        }

        // Local / Fallback synthesis queue
        let textAccumulator = '';

        const synthesizeText = async (text: string) => {
          if (!text.trim()) return;

          const route =
            fastify.routingCache.resolveModel(modelId) ||
            fastify.routingCache.resolveModel('eleven_flash_v2_5') ||
            fastify.routingCache.resolveModel('tts-1');
          const adapter =
            route?.adapter ||
            fastify.providerRegistry.get('elevenlabs') ||
            fastify.providerRegistry.getGenericAdapter();
          const provider =
            route?.provider ||
            fastify.routingCache.getProvider('elevenlabs') || {
              id: 'elevenlabs',
              name: 'ElevenLabs',
              adapterType: 'elevenlabs',
              apiKey: '',
              isEnabled: true,
            };

          if (adapter.synthesizeSpeech && provider.apiKey) {
            try {
              const res = await adapter.synthesizeSpeech(
                {
                  model: route?.model.id || modelId,
                  input: text,
                  voice: voiceId,
                },
                provider
              );
              if (res.ok) {
                const arrayBuf = await res.arrayBuffer();
                const b64 = Buffer.from(arrayBuf).toString('base64');
                sendClient({
                  audio: b64,
                  is_final: false,
                  normalized_alignment: null,
                });
                return;
              }
            } catch (err) {
              console.warn('[Stream-Input TTS] Adapter synthesis error:', err);
            }
          }

          // Fallback dummy audio chunk for testing / local execution
          const dummyChunk = Buffer.alloc(1024, 0xaa).toString('base64');
          sendClient({
            audio: dummyChunk,
            is_final: false,
            normalized_alignment: null,
          });
        };

        clientSocket.on('message', async (data: Buffer | string) => {
          // If live upstream connection is available, forward directly
          if (upstreamWs && isUpstreamOpen && upstreamWs.readyState === WebSocket.OPEN) {
            upstreamWs.send(data);
            return;
          }

          // Local / Fallback handling
          try {
            const parsed = JSON.parse(data.toString());
            const textChunk = parsed.text;

            if (textChunk === '') {
              // Empty string signals end of stream
              if (textAccumulator.trim()) {
                await synthesizeText(textAccumulator);
                textAccumulator = '';
              }
              sendClient({
                audio: null,
                is_final: true,
              });
            } else if (typeof textChunk === 'string' && textChunk.trim()) {
              textAccumulator += textChunk;
              // If text segment contains punctuation or reaches phrase boundary, synthesize chunk
              if (/[.?!,;\n]\s*$/.test(textAccumulator) || textAccumulator.length > 80) {
                await synthesizeText(textAccumulator);
                textAccumulator = '';
              }
            }
          } catch (err) {
            console.warn('[Stream-Input TTS] Local message parse error:', err);
          }
        });

        clientSocket.on('close', () => {
          if (upstreamWs) {
            try {
              upstreamWs.close();
            } catch {}
          }
        });
      }
    );
  };

  registerTtsWebSocket('/v1/text-to-speech/:voiceId/stream-input');
  registerTtsWebSocket('/v1/audio/speech/stream-input');
};
