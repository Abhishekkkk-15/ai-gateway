import type { FastifyRequest, FastifyReply } from 'fastify';
import { createOpenAIError } from '@ai-gateway/core';

export async function authenticateGatewayKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send(
      createOpenAIError(
        'You didn\'t provide an API key. You need to provide your API key in an Authorization header using Bearer auth (i.e. Authorization: Bearer YOUR_KEY)',
        401,
        'invalid_request_error',
        'invalid_api_key'
      )
    );
    return;
  }

  const rawKey = authHeader.slice(7).trim();
  const keyMetadata = request.server.routingCache.validateGatewayKey(rawKey);

  if (!keyMetadata) {
    reply.status(401).send(
      createOpenAIError(
        'Incorrect API key provided. You can check your API key in the admin console.',
        401,
        'invalid_request_error',
        'invalid_api_key'
      )
    );
    return;
  }

  // Attach metadata to request for telemetry logging
  (request as unknown as { gatewayKeyId: string }).gatewayKeyId = keyMetadata.id;
}
