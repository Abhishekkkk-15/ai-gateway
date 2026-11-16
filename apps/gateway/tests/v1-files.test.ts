import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('Files & Uploads API (/v1/files & /v1/uploads)', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-files';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-files-1',
      name: 'Test Files Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function createMultipartFilePayload(
    boundary: string,
    filename: string,
    content: string,
    purpose = 'fine-tune'
  ) {
    return Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\n${purpose}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/jsonl\r\n\r\n${content}\r\n`),
      Buffer.from(`--${boundary}--\r\n`),
    ]);
  }

  describe('POST /v1/files', () => {
    it('rejects unauthenticated request with 401', async () => {
      const boundary = '----BoundaryFile123';
      const payload = createMultipartFilePayload(boundary, 'data.jsonl', '{"prompt": "hi"}');

      const res = await app.inject({
        method: 'POST',
        url: '/v1/files',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error?.code).toBe('invalid_api_key');
    });

    it('uploads a file and returns OpenAI FileObject', async () => {
      const boundary = '----BoundaryFile456';
      const fileData = '{"prompt": "hello", "completion": "world"}\n';
      const payload = createMultipartFilePayload(boundary, 'training.jsonl', fileData, 'fine-tune');

      const res = await app.inject({
        method: 'POST',
        url: '/v1/files',
        headers: {
          Authorization: `Bearer ${validKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });

      expect(res.statusCode).toBe(200);
      const file = JSON.parse(res.body);
      expect(file.id).toMatch(/^file-[a-zA-Z0-9_-]+$/);
      expect(file.object).toBe('file');
      expect(file.filename).toBe('training.jsonl');
      expect(file.purpose).toBe('fine-tune');
      expect(file.status).toBe('processed');
      expect(file.bytes).toBe(fileData.length);
    });
  });

  describe('GET, Content & DELETE /v1/files', () => {
    let createdFileId: string;
    const testContent = '{"input": "rag test file content"}\n';

    beforeAll(async () => {
      const boundary = '----BoundarySetup789';
      const payload = createMultipartFilePayload(boundary, 'assistants_doc.jsonl', testContent, 'assistants');

      const res = await app.inject({
        method: 'POST',
        url: '/v1/files',
        headers: {
          Authorization: `Bearer ${validKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });

      const file = JSON.parse(res.body);
      createdFileId = file.id;
    });

    it('lists files with OpenAI list envelope', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/files',
        headers: { Authorization: `Bearer ${validKey}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.object).toBe('list');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.some((f: any) => f.id === createdFileId)).toBe(true);
    });

    it('filters files by purpose', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/files?purpose=assistants',
        headers: { Authorization: `Bearer ${validKey}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.every((f: any) => f.purpose === 'assistants')).toBe(true);
    });

    it('retrieves specific file metadata by ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/files/${createdFileId}`,
        headers: { Authorization: `Bearer ${validKey}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(createdFileId);
      expect(body.filename).toBe('assistants_doc.jsonl');
    });

    it('downloads the exact binary contents of the file', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/files/${createdFileId}/content`,
        headers: { Authorization: `Bearer ${validKey}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(testContent);
    });

    it('deletes file and returns deletion envelope', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/files/${createdFileId}`,
        headers: { Authorization: `Bearer ${validKey}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(createdFileId);
      expect(body.object).toBe('file');
      expect(body.deleted).toBe(true);

      // Verify subsequent retrieve returns 404
      const getRes = await app.inject({
        method: 'GET',
        url: `/v1/files/${createdFileId}`,
        headers: { Authorization: `Bearer ${validKey}` },
      });
      expect(getRes.statusCode).toBe(404);
    });
  });

  describe('Resumable Uploads (/v1/uploads)', () => {
    it('creates upload session, appends part, and completes upload', async () => {
      // 1. Create upload session
      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/uploads',
        headers: { Authorization: `Bearer ${validKey}` },
        payload: {
          filename: 'chunked_dataset.jsonl',
          purpose: 'fine-tune',
          bytes: 100,
          mime_type: 'application/jsonl',
        },
      });

      expect(createRes.statusCode).toBe(200);
      const upload = JSON.parse(createRes.body);
      expect(upload.id).toMatch(/^upload_[a-zA-Z0-9_-]+$/);
      expect(upload.object).toBe('upload');
      expect(upload.status).toBe('pending');

      const uploadId = upload.id;

      // 2. Add part
      const partBoundary = '----PartBoundary999';
      const partPayload = Buffer.concat([
        Buffer.from(`--${partBoundary}\r\nContent-Disposition: form-data; name="data"; filename="part1.bin"\r\nContent-Type: application/octet-stream\r\n\r\n{"chunk": 1}\n\r\n`),
        Buffer.from(`--${partBoundary}--\r\n`),
      ]);

      const partRes = await app.inject({
        method: 'POST',
        url: `/v1/uploads/${uploadId}/parts`,
        headers: {
          Authorization: `Bearer ${validKey}`,
          'Content-Type': `multipart/form-data; boundary=${partBoundary}`,
        },
        payload: partPayload,
      });

      expect(partRes.statusCode).toBe(200);
      const part = JSON.parse(partRes.body);
      expect(part.id).toMatch(/^part_[a-zA-Z0-9_-]+$/);
      expect(part.object).toBe('upload.part');
      expect(part.upload_id).toBe(uploadId);

      const partId = part.id;

      // 3. Complete upload
      const completeRes = await app.inject({
        method: 'POST',
        url: `/v1/uploads/${uploadId}/complete`,
        headers: { Authorization: `Bearer ${validKey}` },
        payload: {
          part_ids: [partId],
        },
      });

      expect(completeRes.statusCode).toBe(200);
      const finalFile = JSON.parse(completeRes.body);
      expect(finalFile.id).toMatch(/^file-[a-zA-Z0-9_-]+$/);
      expect(finalFile.filename).toBe('chunked_dataset.jsonl');
      expect(finalFile.purpose).toBe('fine-tune');
    });
  });
});
