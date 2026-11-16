import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError } from '@ai-gateway/core';

export const v1AssistantsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/assistants
  fastify.post<{
    Body: {
      model: string;
      name?: string;
      description?: string;
      instructions?: string;
      tools?: Array<{ type: string }>;
      tool_resources?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    };
  }>(
    '/v1/assistants',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const body = request.body;
      if (!body || !body.model) {
        return reply.status(400).send(
          createOpenAIError('The model parameter is required.', 400, 'invalid_request_error')
        );
      }

      const asst = await fastify.assistantRunnerService.createAssistant({
        model: body.model,
        name: body.name,
        description: body.description,
        instructions: body.instructions,
        tools: body.tools,
        toolResources: body.tool_resources,
        metadata: body.metadata,
      });

      return reply.status(200).send(asst);
    }
  );

  // GET /v1/assistants
  fastify.get(
    '/v1/assistants',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const list = await fastify.assistantRunnerService.listAssistants();
      return reply.status(200).send({
        object: 'list',
        data: list,
        has_more: false,
      });
    }
  );

  // GET /v1/assistants/:assistant_id
  fastify.get<{ Params: { assistant_id: string } }>(
    '/v1/assistants/:assistant_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { assistant_id } = request.params;
      const asst = await fastify.assistantRunnerService.getAssistant(assistant_id);
      if (!asst) {
        return reply.status(404).send(
          createOpenAIError(`No such assistant: '${assistant_id}'`, 404, 'invalid_request_error')
        );
      }
      return reply.status(200).send(asst);
    }
  );

  // POST /v1/assistants/:assistant_id (Update)
  fastify.post<{
    Params: { assistant_id: string };
    Body: { name?: string; instructions?: string; model?: string; metadata?: Record<string, unknown> };
  }>(
    '/v1/assistants/:assistant_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { assistant_id } = request.params;
      const updated = await fastify.assistantRunnerService.updateAssistant(assistant_id, request.body || {});
      if (!updated) {
        return reply.status(404).send(
          createOpenAIError(`No such assistant: '${assistant_id}'`, 404, 'invalid_request_error')
        );
      }
      return reply.status(200).send(updated);
    }
  );

  // DELETE /v1/assistants/:assistant_id
  fastify.delete<{ Params: { assistant_id: string } }>(
    '/v1/assistants/:assistant_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { assistant_id } = request.params;
      await fastify.assistantRunnerService.deleteAssistant(assistant_id);
      return reply.status(200).send({
        id: assistant_id,
        object: 'assistant.deleted',
        deleted: true,
      });
    }
  );
};
