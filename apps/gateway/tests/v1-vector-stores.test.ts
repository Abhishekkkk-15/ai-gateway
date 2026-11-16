import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('Vector Stores API (/v1/vector_stores)', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-vectorstores';
  const keyHash = hashGatewayKey(validKey);
  let sampleFileId: string;

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-vs-1',
      name: 'Test Vector Stores Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });

    // Create a sample file in storage
    const file = await app.storageService.saveFile({
      filename: 'knowledge_doc.txt',
      purpose: 'assistants',
      mimeType: 'text/plain',
      buffer: Buffer.from('DeepSeek and Groq offer ultra-low latency inference.', 'utf-8'),
    });
    sampleFileId = file.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/vector_stores',
      payload: { name: 'Unauthorized Store' },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error?.code).toBe('invalid_api_key');
  });

  it('creates vector store and attaches file', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/vector_stores',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        name: 'Technical Docs',
        file_ids: [sampleFileId],
        metadata: { project: 'core_docs' },
      },
    });

    expect(createRes.statusCode).toBe(200);
    const store = JSON.parse(createRes.body);
    expect(store.id).toMatch(/^vs_[a-zA-Z0-9_-]+$/);
    expect(store.object).toBe('vector_store');
    expect(store.name).toBe('Technical Docs');
    expect(store.file_counts.total).toBe(1);
    expect(store.metadata?.project).toBe('core_docs');

    const storeId = store.id;

    // List vector stores
    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/vector_stores',
      headers: { Authorization: `Bearer ${validKey}` },
    });

    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.body);
    expect(list.object).toBe('list');
    expect(list.data.some((s: any) => s.id === storeId)).toBe(true);

    // Retrieve specific store
    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/vector_stores/${storeId}`,
      headers: { Authorization: `Bearer ${validKey}` },
    });

    expect(getRes.statusCode).toBe(200);
    const retrieved = JSON.parse(getRes.body);
    expect(retrieved.id).toBe(storeId);
    expect(retrieved.name).toBe('Technical Docs');
  });

  it('manages files and file batches within vector store', async () => {
    // 1. Create empty vector store
    const storeRes = await app.inject({
      method: 'POST',
      url: '/v1/vector_stores',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: { name: 'Batch Docs Store' },
    });
    const store = JSON.parse(storeRes.body);
    const storeId = store.id;

    // 2. Add single file to store
    const addFileRes = await app.inject({
      method: 'POST',
      url: `/v1/vector_stores/${storeId}/files`,
      headers: { Authorization: `Bearer ${validKey}` },
      payload: { file_id: sampleFileId },
    });

    expect(addFileRes.statusCode).toBe(200);
    const addedFile = JSON.parse(addFileRes.body);
    expect(addedFile.id).toBe(sampleFileId);
    expect(addedFile.object).toBe('vector_store.file');
    expect(addedFile.vector_store_id).toBe(storeId);

    // 3. List files in vector store
    const listFilesRes = await app.inject({
      method: 'GET',
      url: `/v1/vector_stores/${storeId}/files`,
      headers: { Authorization: `Bearer ${validKey}` },
    });

    expect(listFilesRes.statusCode).toBe(200);
    const fileList = JSON.parse(listFilesRes.body);
    expect(fileList.data.some((f: any) => f.id === sampleFileId)).toBe(true);

    // 4. Create file batch
    const batchRes = await app.inject({
      method: 'POST',
      url: `/v1/vector_stores/${storeId}/file_batches`,
      headers: { Authorization: `Bearer ${validKey}` },
      payload: { file_ids: [sampleFileId] },
    });

    expect(batchRes.statusCode).toBe(200);
    const fileBatch = JSON.parse(batchRes.body);
    expect(fileBatch.id).toMatch(/^vsfb_[a-zA-Z0-9_-]+$/);
    expect(fileBatch.object).toBe('vector_store.file_batch');
    expect(fileBatch.vector_store_id).toBe(storeId);

    // 5. Delete file from vector store
    const delFileRes = await app.inject({
      method: 'DELETE',
      url: `/v1/vector_stores/${storeId}/files/${sampleFileId}`,
      headers: { Authorization: `Bearer ${validKey}` },
    });

    expect(delFileRes.statusCode).toBe(200);
    const deletedFile = JSON.parse(delFileRes.body);
    expect(deletedFile.deleted).toBe(true);

    // 6. Delete vector store
    const delStoreRes = await app.inject({
      method: 'DELETE',
      url: `/v1/vector_stores/${storeId}`,
      headers: { Authorization: `Bearer ${validKey}` },
    });

    expect(delStoreRes.statusCode).toBe(200);
    const deletedStore = JSON.parse(delStoreRes.body);
    expect(deletedStore.deleted).toBe(true);
  });
});
