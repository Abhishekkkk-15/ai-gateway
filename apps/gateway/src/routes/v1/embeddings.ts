import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError, type OpenAIEmbeddingRequest } from '@ai-gateway/core';

export const v1EmbeddingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: OpenAIEmbeddingRequest }>(
    '/v1/embeddings',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const startTime = Date.now();
      const body = request.body;

      if (!body || !body.model) {
        return reply.status(400).send(
          createOpenAIError(
            'The model parameter is required.',
            400,
            'invalid_request_error',
            'missing_required_parameter'
          )
        );
      }

      if (
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

      const route = fastify.routingCache.resolveModel(body.model);
      if (!route) {
        const errorMsg = fastify.routingCache.explainMissingModel(body.model);
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

      if (!model.capabilities.includes('embeddings')) {
        return reply.status(400).send(
          createOpenAIError(
            `Model '${model.slug}' does not support embeddings. Model capabilities: [${model.capabilities.join(', ')}].`,
            400,
            'invalid_request_error'
          )
        );
      }

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

      // Prepare request for upstream provider (use upstream provider's internal model.id)
      const upstreamPayload: OpenAIEmbeddingRequest = {
        ...body,
        model: model.id,
      };

      try {
        const upstreamResponse = await (adapter.createEmbeddings
          ? adapter.createEmbeddings(upstreamPayload, provider, abortController.signal)
          : fastify.providerRegistry.getGenericAdapter().createEmbeddings!(
              upstreamPayload,
              provider,
              abortController.signal
            ));

        reply.status(upstreamResponse.status);

        if (!upstreamResponse.ok) {
          const latencyMs = Date.now() - startTime;
          const errorText = await upstreamResponse.text().catch(() => 'Upstream error');

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

          try {
            const parsed = JSON.parse(errorText);
            const cleanMessage =
              parsed?.detail?.message ||
              parsed?.error?.message ||
              parsed?.message ||
              errorText;
            return reply.send(
              createOpenAIError(
                cleanMessage,
                upstreamResponse.status,
                parsed?.error?.type || 'upstream_error',
                parsed?.error?.code
              )
            );
          } catch {
            return reply.send(
              createOpenAIError(errorText, upstreamResponse.status, 'upstream_error')
            );
          }
        }

        const data = await upstreamResponse.json();
        const latencyMs = Date.now() - startTime;

        fastify.telemetryQueue.enqueue({
          timestamp: new Date(),
          modelSlug: model.slug,
          providerId: provider.id,
          gatewayKeyId,
          statusCode: 200,
          isStreaming: false,
          latencyMs,
          promptTokens: (data as { usage?: { prompt_tokens?: number } })?.usage?.prompt_tokens,
          completionTokens: 0,
        });

        reply.header('Content-Type', 'application/json');
        return reply.send(data);
      } catch (err: unknown) {
        const latencyMs = Date.now() - startTime;
        const message = err instanceof Error ? err.message : 'Embedding request failed';

        fastify.telemetryQueue.enqueue({
          timestamp: new Date(),
          modelSlug: model.slug,
          providerId: provider.id,
          gatewayKeyId,
          statusCode: 500,
          isStreaming: false,
          latencyMs,
          errorMessage: message,
        });

        return reply
          .status(500)
          .send(createOpenAIError(message, 500, 'internal_error'));
      }
    }
  );
};
