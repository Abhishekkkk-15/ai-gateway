import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError, type OpenAIChatCompletionRequest } from '@ai-gateway/core';
import { Readable } from 'node:stream';

export const v1ChatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: OpenAIChatCompletionRequest }>(
    '/v1/chat/completions',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const startTime = Date.now();
      const body = request.body;

      if (!body || !body.model) {
        return reply.status(400).send(
          createOpenAIError('The model parameter is required.', 400, 'invalid_request_error', 'missing_required_parameter')
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

      // Prepare request for upstream provider (use internal model.id)
      const upstreamPayload: OpenAIChatCompletionRequest = {
        ...body,
        model: model.id,
      };

      try {
        const upstreamResponse = await (adapter.chatCompletions
          ? adapter.chatCompletions(upstreamPayload, provider, abortController.signal)
          : fastify.providerRegistry.getGenericAdapter().chatCompletions!(upstreamPayload, provider, abortController.signal));

        const contentType = upstreamResponse.headers.get('content-type') || 'application/json';
        const isStreaming = contentType.includes('text/event-stream') || Boolean(body.stream);

        // Forward status code
        reply.status(upstreamResponse.status);

        // If upstream failed
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
            const parsed = JSON.parse(errorText) as Record<string, unknown>;
            if (parsed.error) {
              return reply.send(parsed);
            }
          } catch {
            // Not json
          }

          return reply.send(
            createOpenAIError(
              `Upstream ${provider.name} error: ${errorText}`,
              upstreamResponse.status,
              upstreamResponse.status === 429 ? 'rate_limit_error' : 'upstream_error',
              upstreamResponse.status === 429 ? 'rate_limit_exceeded' : null
            )
          );
        }

        // Streaming handling
        if (isStreaming && upstreamResponse.body) {
          reply.header('Content-Type', 'text/event-stream');
          reply.header('Cache-Control', 'no-cache, no-transform');
          reply.header('Connection', 'keep-alive');
          reply.header('X-Accel-Buffering', 'no');

          let firstChunkTime: number | null = null;
          const nodeStream = Readable.fromWeb(upstreamResponse.body as unknown as import('node:stream/web').ReadableStream);

          nodeStream.once('data', () => {
            firstChunkTime = Date.now();
          });

          nodeStream.on('end', () => {
            const latencyMs = Date.now() - startTime;
            const ttftMs = firstChunkTime ? firstChunkTime - startTime : null;

            fastify.telemetryQueue.enqueue({
              timestamp: new Date(),
              modelSlug: model.slug,
              providerId: provider.id,
              gatewayKeyId,
              statusCode: 200,
              isStreaming: true,
              ttftMs,
              latencyMs,
            });
          });

          return reply.send(nodeStream);
        }

        // Non-streaming JSON handling
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
          completionTokens: (data as { usage?: { completion_tokens?: number } })?.usage?.completion_tokens,
        });

        return reply.header('Content-Type', 'application/json').send(data);
      } catch (err: unknown) {
        const latencyMs = Date.now() - startTime;
        const message = err instanceof Error ? err.message : 'Unknown gateway error';

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

        return reply.status(500).send(createOpenAIError(message, 500, 'api_error'));
      }
    }
  );
};
