import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError, type OpenAIModerationRequest } from '@ai-gateway/core';

export const v1ModerationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: OpenAIModerationRequest }>(
    '/v1/moderations',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const startTime = Date.now();
      const body = request.body;

      if (
        !body ||
        body.input === undefined ||
        body.input === null ||
        body.input === '' ||
        (Array.isArray(body.input) && body.input.length === 0)
      ) {
        return reply.status(400).send(
          createOpenAIError(
            'The input parameter is required and cannot be empty.',
            400,
            'invalid_request_error',
            'missing_required_parameter'
          )
        );
      }

      const requestedModel = body.model || 'omni-moderation-latest';
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

      const upstreamPayload: OpenAIModerationRequest = {
        ...body,
        model: model.id,
      };

      try {
        const upstreamResponse = await (adapter.createModeration
          ? adapter.createModeration(upstreamPayload, provider, abortController.signal)
          : fastify.providerRegistry.getGenericAdapter().createModeration!(
              upstreamPayload,
              provider,
              abortController.signal
            ));

        reply.status(upstreamResponse.status);

        if (!upstreamResponse.ok) {
          const latencyMs = Date.now() - startTime;
          const errorText = await upstreamResponse.text().catch(() => 'Upstream moderation error');

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

          return reply.send(createOpenAIError(errorText, upstreamResponse.status, 'moderation_error'));
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
        const message = err instanceof Error ? err.message : 'Moderation error';
        return reply.status(500).send(createOpenAIError(message, 500, 'moderation_error'));
      }
    }
  );
};
