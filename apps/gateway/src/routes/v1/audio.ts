import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError, type OpenAISpeechRequest } from '@ai-gateway/core';
import { Readable } from 'node:stream';

/** Experimental: audio is outside the curated chat/embeddings/images/responses catalog. */
const EXPERIMENTAL_AUDIO_HEADER = 'experimental';

export const v1AudioRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/audio/speech (experimental)
  fastify.post<{ Body: OpenAISpeechRequest }>(
    '/v1/audio/speech',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      reply.header('X-Gateway-Feature', EXPERIMENTAL_AUDIO_HEADER);
      const startTime = Date.now();
      const body = request.body;

      if (!body || !body.input) {
        return reply.status(400).send(
          createOpenAIError('The input parameter is required for speech synthesis.', 400, 'invalid_request_error')
        );
      }

      // Model or provider resolution (defaults to elevenlabs if unspecified or model matches)
      const requestedModel = body.model || 'eleven_flash_v2_5';
      const route = fastify.routingCache.resolveModel(requestedModel);

      // Resolve adapter & provider (routed model, or configured elevenlabs provider)
      const adapter = route?.adapter || fastify.providerRegistry.get('elevenlabs') || fastify.providerRegistry.getGenericAdapter();
      const provider = route?.provider || fastify.routingCache.getProvider('elevenlabs') || {
        id: 'elevenlabs',
        name: 'ElevenLabs',
        adapterType: 'elevenlabs',
        apiKey: '',
        isEnabled: true,
      };

      const abortController = new AbortController();
      request.raw.on('close', () => {
        if (!reply.raw.writableEnded) {
          abortController.abort();
        }
      });
      if (request.signal) {
        request.signal.addEventListener('abort', () => abortController.abort());
      }

      try {
        if (!adapter.synthesizeSpeech) {
          return reply.status(400).send(
            createOpenAIError('Selected provider does not support speech synthesis.', 400, 'invalid_request_error')
          );
        }

        const upstreamResponse = await adapter.synthesizeSpeech(
          {
            ...body,
            model: route?.model.id || requestedModel,
          },
          provider,
          abortController.signal
        );

        if (!upstreamResponse.ok) {
          const errText = await upstreamResponse.text().catch(() => 'Audio synthesis error');
          let cleanMessage = errText;
          try {
            const parsed = JSON.parse(errText);
            cleanMessage =
              parsed?.detail?.message ||
              parsed?.error?.message ||
              parsed?.message ||
              errText;
          } catch {
            // Keep original string if not JSON
          }

          return reply.status(upstreamResponse.status).send(
            createOpenAIError(cleanMessage, upstreamResponse.status, 'audio_synthesis_error')
          );
        }

        reply.header('Content-Type', upstreamResponse.headers.get('content-type') || 'audio/mpeg');
        reply.header('Transfer-Encoding', 'chunked');

        if (upstreamResponse.body) {
          const nodeStream = Readable.fromWeb(upstreamResponse.body as unknown as import('node:stream/web').ReadableStream);
          return reply.send(nodeStream);
        }

        const buffer = await upstreamResponse.arrayBuffer();
        return reply.send(Buffer.from(buffer));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Audio synthesis failed';
        return reply.status(500).send(createOpenAIError(message, 500, 'audio_error'));
      }
    }
  );

  // POST /v1/audio/transcriptions (experimental)
  fastify.post(
    '/v1/audio/transcriptions',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      reply.header('X-Gateway-Feature', EXPERIMENTAL_AUDIO_HEADER);
      try {
        const parts = request.parts();
        const formData = new FormData();
        let requestedModel = 'whisper-large-v3-turbo';

        for await (const part of parts) {
          if (part.type === 'file') {
            const buffer = await part.toBuffer();
            const blob = new Blob([buffer], { type: part.mimetype });
            formData.append(part.fieldname, blob, part.filename);
          } else {
            formData.append(part.fieldname, part.value as string);
            if (part.fieldname === 'model') {
              requestedModel = part.value as string;
            }
          }
        }

        const route = fastify.routingCache.resolveModel(requestedModel);
        const upstreamModelId = route ? route.model.id : requestedModel.replace(/^[a-z0-9_-]+\//, '');
        formData.set('model', upstreamModelId);
        const adapter = route?.adapter || fastify.providerRegistry.getGenericAdapter();
        const provider = route?.provider || fastify.routingCache.getProvider('groq') || {
          id: 'groq',
          name: 'Groq',
          adapterType: 'openai-compatible',
          apiKey: '',
          isEnabled: true,
        };

        if (!adapter.transcribeAudio) {
          return reply.status(400).send(
            createOpenAIError('Selected provider does not support audio transcription.', 400, 'invalid_request_error')
          );
        }

        const upstreamResponse = await adapter.transcribeAudio(formData, provider);

        if (!upstreamResponse.ok) {
          const errText = await upstreamResponse.text().catch(() => 'Audio transcription error');
          return reply.status(upstreamResponse.status).send(
            createOpenAIError(errText, upstreamResponse.status, 'transcription_error')
          );
        }

        const data = await upstreamResponse.json();
        return reply.status(upstreamResponse.status).send(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Transcription failed';
        return reply.status(500).send(createOpenAIError(message, 500, 'transcription_error'));
      }
    }
  );

  // POST /v1/audio/translations (experimental)
  fastify.post(
    '/v1/audio/translations',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      reply.header('X-Gateway-Feature', EXPERIMENTAL_AUDIO_HEADER);
      try {
        const parts = request.parts();
        const formData = new FormData();
        let requestedModel = 'whisper-large-v3-turbo';

        for await (const part of parts) {
          if (part.type === 'file') {
            const buffer = await part.toBuffer();
            const blob = new Blob([buffer], { type: part.mimetype });
            formData.append(part.fieldname, blob, part.filename);
          } else {
            formData.append(part.fieldname, part.value as string);
            if (part.fieldname === 'model') {
              requestedModel = part.value as string;
            }
          }
        }

        const route = fastify.routingCache.resolveModel(requestedModel);
        const upstreamModelId = route ? route.model.id : requestedModel.replace(/^[a-z0-9_-]+\//, '');
        formData.set('model', upstreamModelId);
        const adapter = route?.adapter || fastify.providerRegistry.getGenericAdapter();
        const provider = route?.provider || fastify.routingCache.getProvider('groq') || {
          id: 'groq',
          name: 'Groq',
          adapterType: 'openai-compatible',
          apiKey: '',
          isEnabled: true,
        };

        if (!adapter.translateAudio) {
          return reply.status(400).send(
            createOpenAIError(
              'Selected provider does not support audio translation.',
              400,
              'invalid_request_error'
            )
          );
        }

        const upstreamResponse = await adapter.translateAudio(formData, provider);

        if (!upstreamResponse.ok) {
          const errText = await upstreamResponse.text().catch(() => 'Audio translation error');
          return reply.status(upstreamResponse.status).send(
            createOpenAIError(errText, upstreamResponse.status, 'translation_error')
          );
        }

        const data = await upstreamResponse.json();
        return reply.status(upstreamResponse.status).send(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Translation failed';
        return reply.status(500).send(createOpenAIError(message, 500, 'translation_error'));
      }
    }
  );
};
