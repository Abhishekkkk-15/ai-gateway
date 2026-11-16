import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError } from '@ai-gateway/core';

export const v1UploadsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/uploads (Create upload session)
  fastify.post<{
    Body: {
      bytes: number;
      filename: string;
      purpose: string;
      mime_type?: string;
    };
  }>(
    '/v1/uploads',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const body = request.body;
      if (!body || !body.filename || !body.bytes || !body.purpose) {
        return reply.status(400).send(
          createOpenAIError('Missing required upload parameters: bytes, filename, purpose.', 400, 'invalid_request_error')
        );
      }

      const upload = await fastify.storageService.createUpload({
        filename: body.filename,
        purpose: body.purpose,
        bytes: body.bytes,
        mimeType: body.mime_type,
      });

      return reply.status(200).send(upload);
    }
  );

  // POST /v1/uploads/:upload_id/parts (Upload part)
  fastify.post<{ Params: { upload_id: string } }>(
    '/v1/uploads/:upload_id/parts',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { upload_id } = request.params;
      try {
        const parts = request.parts();
        let partBuffer: Buffer | null = null;

        for await (const part of parts) {
          if (part.type === 'file') {
            partBuffer = await part.toBuffer();
          }
        }

        if (!partBuffer) {
          return reply.status(400).send(
            createOpenAIError('No part file payload provided.', 400, 'invalid_request_error')
          );
        }

        const part = await fastify.storageService.addUploadPart(upload_id, partBuffer);
        if (!part) {
          return reply.status(404).send(
            createOpenAIError(`No active upload session with id: '${upload_id}'`, 404, 'invalid_request_error')
          );
        }

        return reply.status(200).send(part);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload part failed';
        return reply.status(500).send(createOpenAIError(message, 500, 'upload_part_error'));
      }
    }
  );

  // POST /v1/uploads/:upload_id/complete
  fastify.post<{ Params: { upload_id: string }; Body: { part_ids: string[] } }>(
    '/v1/uploads/:upload_id/complete',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { upload_id } = request.params;
      const { part_ids } = request.body || {};

      if (!part_ids || !Array.isArray(part_ids) || part_ids.length === 0) {
        return reply.status(400).send(
          createOpenAIError('Missing part_ids array.', 400, 'invalid_request_error')
        );
      }

      const file = await fastify.storageService.completeUpload(upload_id, part_ids);
      if (!file) {
        return reply.status(404).send(
          createOpenAIError(`Failed to complete upload for session: '${upload_id}'`, 404, 'invalid_request_error')
        );
      }

      return reply.status(200).send(file);
    }
  );

  // POST /v1/uploads/:upload_id/cancel
  fastify.post<{ Params: { upload_id: string } }>(
    '/v1/uploads/:upload_id/cancel',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { upload_id } = request.params;
      await fastify.storageService.cancelUpload(upload_id);
      return reply.status(200).send({
        id: upload_id,
        object: 'upload',
        status: 'cancelled',
      });
    }
  );
};
