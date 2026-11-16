import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError, type OpenAIImageGenerateRequest } from '@ai-gateway/core';

export const v1ImagesRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/images/generations
  fastify.post<{ Body: OpenAIImageGenerateRequest }>(
    '/v1/images/generations',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const startTime = Date.now();
      const body = request.body;

      if (!body || !body.prompt || typeof body.prompt !== 'string' || body.prompt.trim() === '') {
        return reply.status(400).send(
          createOpenAIError(
            'The prompt parameter is required.',
            400,
            'invalid_request_error',
            'missing_required_parameter'
          )
        );
      }

      const requestedModel = body.model || 'dall-e-3';
      const route = fastify.routingCache.resolveModel(requestedModel);

      if (!route) {
        const errorMsg = fastify.routingCache.explainMissingModel(requestedModel);
        return reply.status(404).send(
          createOpenAIError(
            errorMsg,
            404,
            'invalid_request_error',
            'model_not_found'
          )
        );
      }

      const { model, provider, adapter } = route;
      const gatewayKeyId = (request as unknown as { gatewayKeyId?: string }).gatewayKeyId;

      // Handle client disconnect abortion
      const abortController = new AbortController();
      request.raw.on('close', () => {
        if (!reply.raw.writableEnded) {
          abortController.abort();
        }
      });
      if (request.signal) {
        request.signal.addEventListener('abort', () => abortController.abort());
      }

      const upstreamPayload: OpenAIImageGenerateRequest = {
        ...body,
        model: model.id,
      };

      try {
        const upstreamResponse = await (adapter.generateImages
          ? adapter.generateImages(upstreamPayload, provider, abortController.signal)
          : fastify.providerRegistry.getGenericAdapter().generateImages!(
              upstreamPayload,
              provider,
              abortController.signal
            ));

        reply.status(upstreamResponse.status);

        if (!upstreamResponse.ok) {
          const latencyMs = Date.now() - startTime;
          const errorText = await upstreamResponse.text().catch(() => 'Upstream image error');

          fastify.telemetryQueue.enqueue({
            timestamp: new Date(),
            modelSlug: model.slug,
            providerId: provider.id,
            gatewayKeyId,
            statusCode: upstreamResponse.status,
            isStreaming: false,
            latencyMs,
            errorMessage: errorText.slice(0, 500),
          });

          return reply.send(createOpenAIError(errorText, upstreamResponse.status, 'image_generation_error'));
        }

        const data = await upstreamResponse.json();
        const latencyMs = Date.now() - startTime;

        fastify.telemetryQueue.enqueue({
          timestamp: new Date(),
          modelSlug: model.slug,
          providerId: provider.id,
          gatewayKeyId,
          statusCode: upstreamResponse.status,
          isStreaming: false,
          latencyMs,
        });

        return reply.send(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Image generation error';
        return reply.status(500).send(createOpenAIError(message, 500, 'image_generation_error'));
      }
    }
  );

  // POST /v1/images/edits
  fastify.post(
    '/v1/images/edits',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      try {
        const parts = request.parts();
        const formData = new FormData();
        let requestedModel = 'dall-e-2';

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
        const adapter = route?.adapter || fastify.providerRegistry.getGenericAdapter();
        const provider = route?.provider || {
          id: 'openai-compatible',
          name: 'OpenAI Compatible',
          adapterType: 'openai-compatible',
          apiKey: '',
          isEnabled: true,
        };

        if (!adapter.editImages) {
          return reply.status(400).send(
            createOpenAIError('Selected provider does not support image editing.', 400, 'invalid_request_error')
          );
        }

        const upstreamResponse = await adapter.editImages(formData, provider);

        if (!upstreamResponse.ok) {
          const errText = await upstreamResponse.text().catch(() => 'Image edit error');
          return reply.status(upstreamResponse.status).send(
            createOpenAIError(errText, upstreamResponse.status, 'image_edit_error')
          );
        }

        const data = await upstreamResponse.json();
        return reply.status(upstreamResponse.status).send(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Image edit failed';
        return reply.status(500).send(createOpenAIError(message, 500, 'image_edit_error'));
      }
    }
  );

  // POST /v1/images/variations
  fastify.post(
    '/v1/images/variations',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      try {
        const parts = request.parts();
        const formData = new FormData();
        let requestedModel = 'dall-e-2';

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
        const adapter = route?.adapter || fastify.providerRegistry.getGenericAdapter();
        const provider = route?.provider || {
          id: 'openai-compatible',
          name: 'OpenAI Compatible',
          adapterType: 'openai-compatible',
          apiKey: '',
          isEnabled: true,
        };

        if (!adapter.createImageVariations) {
          return reply.status(400).send(
            createOpenAIError('Selected provider does not support image variations.', 400, 'invalid_request_error')
          );
        }

        const upstreamResponse = await adapter.createImageVariations(formData, provider);

        if (!upstreamResponse.ok) {
          const errText = await upstreamResponse.text().catch(() => 'Image variation error');
          return reply.status(upstreamResponse.status).send(
            createOpenAIError(errText, upstreamResponse.status, 'image_variation_error')
          );
        }

        const data = await upstreamResponse.json();
        return reply.status(upstreamResponse.status).send(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Image variation failed';
        return reply.status(500).send(createOpenAIError(message, 500, 'image_variation_error'));
      }
    }
  );
};
