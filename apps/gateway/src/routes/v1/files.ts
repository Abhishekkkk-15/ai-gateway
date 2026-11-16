import type { FastifyPluginAsync } from 'fastify';
import { authenticateGatewayKey } from './auth.js';
import { createOpenAIError } from '@ai-gateway/core';

export const v1FilesRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/files (Multipart upload)
  fastify.post(
    '/v1/files',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      try {
        const parts = request.parts();
        let filename = 'file.bin';
        let purpose = 'assistants';
        let mimeType = 'application/octet-stream';
        let fileBuffer: Buffer | null = null;

        for await (const part of parts) {
          if (part.type === 'file') {
            filename = part.filename;
            mimeType = part.mimetype;
            fileBuffer = await part.toBuffer();
          } else {
            if (part.fieldname === 'purpose') {
              purpose = part.value as string;
            }
          }
        }

        if (!fileBuffer) {
          return reply.status(400).send(
            createOpenAIError('No file provided in multipart request.', 400, 'invalid_request_error')
          );
        }

        const file = await fastify.storageService.saveFile({
          filename,
          purpose,
          mimeType,
          buffer: fileBuffer,
        });

        return reply.status(200).send(file);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'File upload failed';
        return reply.status(500).send(createOpenAIError(message, 500, 'file_upload_error'));
      }
    }
  );

  // GET /v1/files (List files)
  fastify.get<{ Querystring: { purpose?: string } }>(
    '/v1/files',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { purpose } = request.query;
      const files = await fastify.storageService.listFiles(purpose);
      return reply.status(200).send({
        object: 'list',
        data: files,
        has_more: false,
      });
    }
  );

  // GET /v1/files/:file_id (Retrieve file metadata)
  fastify.get<{ Params: { file_id: string } }>(
    '/v1/files/:file_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { file_id } = request.params;
      const file = await fastify.storageService.getFile(file_id);
      if (!file) {
        return reply.status(404).send(
          createOpenAIError(`No such file: '${file_id}'`, 404, 'invalid_request_error')
        );
      }
      return reply.status(200).send(file);
    }
  );

  // GET /v1/files/:file_id/content (Download file content)
  fastify.get<{ Params: { file_id: string } }>(
    '/v1/files/:file_id/content',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { file_id } = request.params;
      const content = await fastify.storageService.getFileContent(file_id);
      if (!content) {
        return reply.status(404).send(
          createOpenAIError(`No such file content: '${file_id}'`, 404, 'invalid_request_error')
        );
      }

      reply.header('Content-Type', content.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${content.filename}"`);
      return reply.status(200).send(content.buffer);
    }
  );

  // DELETE /v1/files/:file_id
  fastify.delete<{ Params: { file_id: string } }>(
    '/v1/files/:file_id',
    { preHandler: authenticateGatewayKey },
    async (request, reply) => {
      const { file_id } = request.params;
      const file = await fastify.storageService.getFile(file_id);
      if (!file) {
        return reply.status(404).send(
          createOpenAIError(`No such file: '${file_id}'`, 404, 'invalid_request_error')
        );
      }

      await fastify.storageService.deleteFile(file_id);
      return reply.status(200).send({
        id: file_id,
        object: 'file',
        deleted: true,
      });
    }
  );
};
