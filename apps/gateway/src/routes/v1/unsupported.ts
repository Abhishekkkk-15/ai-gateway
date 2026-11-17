import type { FastifyReply, FastifyRequest, RouteHandlerMethod } from 'fastify';
import { createUnsupportedResourceError } from '@ai-gateway/core';
import { authenticateGatewayKey } from './auth.js';

/**
 * Shared 501 handler for catalog-NO OpenAI surfaces.
 * Auth still runs so clients get 401 before unsupported.
 */
export function unsupportedResourceHandler(resource: string, detail?: string): RouteHandlerMethod {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(501).send(createUnsupportedResourceError(resource, detail));
  };
}

export const unsupportedRouteOpts = { preHandler: authenticateGatewayKey };
