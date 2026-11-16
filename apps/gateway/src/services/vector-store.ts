import crypto from 'node:crypto';
import type { DbClient } from '@ai-gateway/db';
import { vectorStoresTable, vectorStoreFilesTable, eq, and } from '@ai-gateway/db';
import type { StorageService } from './storage.js';

export interface OpenAIVectorStoreObject {
  id: string;
  object: 'vector_store';
  created_at: number;
  name: string;
  bytes: number;
  file_counts: {
    in_progress: number;
    completed: number;
    failed: number;
    cancelled: number;
    total: number;
  };
  status: 'completed' | 'in_progress' | 'expired';
  expires_after?: { anchor: string; days: number } | null;
  expires_at?: number | null;
  last_active_at: number;
  metadata?: Record<string, unknown> | null;
}

export interface OpenAIVectorStoreFileObject {
  id: string;
  object: 'vector_store.file';
  usage_bytes: number;
  created_at: number;
  vector_store_id: string;
  status: 'in_progress' | 'completed' | 'cancelled' | 'failed';
  last_error?: unknown | null;
  chunking_strategy?: { type: string } | null;
}

export interface OpenAIVectorStoreFileBatchObject {
  id: string;
  object: 'vector_store.file_batch';
  created_at: number;
  vector_store_id: string;
  status: 'in_progress' | 'completed' | 'cancelled' | 'failed';
  file_counts: {
    in_progress: number;
    completed: number;
    failed: number;
    cancelled: number;
    total: number;
  };
}

export class VectorStoreService {
  private db: DbClient | null;
  private storageService: StorageService;
  private memoryStores = new Map<string, OpenAIVectorStoreObject>();
  private memoryFiles = new Map<string, Map<string, OpenAIVectorStoreFileObject>>(); // storeId -> fileId -> file
  private memoryBatches = new Map<string, OpenAIVectorStoreFileBatchObject>();

  constructor(db: DbClient | null, storageService: StorageService) {
    this.db = db;
    this.storageService = storageService;
  }

  private generateId(prefix: string): string {
    return `${prefix}${crypto.randomBytes(12).toString('hex')}`;
  }

  async createVectorStore(params: {
    name?: string;
    fileIds?: string[];
    metadata?: Record<string, unknown>;
    expiresAfter?: { anchor: string; days: number };
  }): Promise<OpenAIVectorStoreObject> {
    const id = this.generateId('vs_');
    const now = Math.floor(Date.now() / 1000);
    const initialFiles = params.fileIds || [];

    const store: OpenAIVectorStoreObject = {
      id,
      object: 'vector_store',
      created_at: now,
      name: params.name || 'Default Vector Store',
      bytes: 0,
      file_counts: {
        in_progress: 0,
        completed: initialFiles.length,
        failed: 0,
        cancelled: 0,
        total: initialFiles.length,
      },
      status: 'completed',
      expires_after: params.expiresAfter || null,
      expires_at: params.expiresAfter ? now + params.expiresAfter.days * 86400 : null,
      last_active_at: now,
      metadata: params.metadata || null,
    };

    this.memoryStores.set(id, store);
    const fileMap = new Map<string, OpenAIVectorStoreFileObject>();
    for (const fId of initialFiles) {
      fileMap.set(fId, {
        id: fId,
        object: 'vector_store.file',
        usage_bytes: 1024,
        created_at: now,
        vector_store_id: id,
        status: 'completed',
        last_error: null,
      });
    }
    this.memoryFiles.set(id, fileMap);

    if (this.db) {
      try {
        await this.db.insert(vectorStoresTable).values({
          id,
          name: store.name,
          bytes: 0,
          status: 'completed',
          fileCounts: store.file_counts,
          metadata: store.metadata || null,
          createdAt: new Date(now * 1000),
          lastActiveAt: new Date(now * 1000),
          expiresAt: store.expires_at ? new Date(store.expires_at * 1000) : null,
        });

        for (const fId of initialFiles) {
          await this.db.insert(vectorStoreFilesTable).values({
            id: fId,
            vectorStoreId: id,
            usageBytes: 1024,
            status: 'completed',
            createdAt: new Date(now * 1000),
          });
        }
      } catch (err) {
        console.error('[VectorStoreService] Failed to insert store into DB:', err);
      }
    }

    return store;
  }

  async listVectorStores(): Promise<OpenAIVectorStoreObject[]> {
    if (this.db) {
      try {
        const rows = await this.db.select().from(vectorStoresTable);
        for (const row of rows) {
          if (!this.memoryStores.has(row.id)) {
            this.memoryStores.set(row.id, {
              id: row.id,
              object: 'vector_store',
              created_at: Math.floor(row.createdAt.getTime() / 1000),
              name: row.name,
              bytes: row.bytes,
              file_counts: row.fileCounts,
              status: (row.status as any) || 'completed',
              last_active_at: Math.floor(row.lastActiveAt.getTime() / 1000),
              expires_at: row.expiresAt ? Math.floor(row.expiresAt.getTime() / 1000) : null,
              metadata: row.metadata,
            });
          }
        }
      } catch (err) {
        console.error('[VectorStoreService] Failed to list stores from DB:', err);
      }
    }
    return Array.from(this.memoryStores.values());
  }

  async getVectorStore(id: string): Promise<OpenAIVectorStoreObject | null> {
    const memory = this.memoryStores.get(id);
    if (memory) return memory;

    if (this.db) {
      try {
        const rows = await this.db.select().from(vectorStoresTable).where(eq(vectorStoresTable.id, id)).limit(1);
        if (rows.length > 0) {
          const row = rows[0];
          const obj: OpenAIVectorStoreObject = {
            id: row.id,
            object: 'vector_store',
            created_at: Math.floor(row.createdAt.getTime() / 1000),
            name: row.name,
            bytes: row.bytes,
            file_counts: row.fileCounts,
            status: (row.status as any) || 'completed',
            last_active_at: Math.floor(row.lastActiveAt.getTime() / 1000),
            expires_at: row.expiresAt ? Math.floor(row.expiresAt.getTime() / 1000) : null,
            metadata: row.metadata,
          };
          this.memoryStores.set(row.id, obj);
          return obj;
        }
      } catch (err) {
        console.error('[VectorStoreService] Failed to get store from DB:', err);
      }
    }
    return null;
  }

  async updateVectorStore(
    id: string,
    updates: { name?: string; metadata?: Record<string, unknown> }
  ): Promise<OpenAIVectorStoreObject | null> {
    const store = await this.getVectorStore(id);
    if (!store) return null;

    if (updates.name) store.name = updates.name;
    if (updates.metadata) store.metadata = updates.metadata;

    if (this.db) {
      try {
        await this.db
          .update(vectorStoresTable)
          .set({ name: store.name, metadata: store.metadata || null })
          .where(eq(vectorStoresTable.id, id));
      } catch (err) {
        console.error('[VectorStoreService] Failed to update store in DB:', err);
      }
    }

    return store;
  }

  async deleteVectorStore(id: string): Promise<boolean> {
    this.memoryStores.delete(id);
    this.memoryFiles.delete(id);

    if (this.db) {
      try {
        await this.db.delete(vectorStoresTable).where(eq(vectorStoresTable.id, id));
      } catch (err) {
        console.error('[VectorStoreService] Failed to delete store in DB:', err);
      }
    }

    return true;
  }

  async addFileToStore(vectorStoreId: string, fileId: string): Promise<OpenAIVectorStoreFileObject | null> {
    const store = await this.getVectorStore(vectorStoreId);
    if (!store) return null;

    const now = Math.floor(Date.now() / 1000);
    const fileObj: OpenAIVectorStoreFileObject = {
      id: fileId,
      object: 'vector_store.file',
      usage_bytes: 1024,
      created_at: now,
      vector_store_id: vectorStoreId,
      status: 'completed',
      last_error: null,
    };

    let filesMap = this.memoryFiles.get(vectorStoreId);
    if (!filesMap) {
      filesMap = new Map();
      this.memoryFiles.set(vectorStoreId, filesMap);
    }
    filesMap.set(fileId, fileObj);

    store.file_counts.total++;
    store.file_counts.completed++;

    if (this.db) {
      try {
        await this.db.insert(vectorStoreFilesTable).values({
          id: fileId,
          vectorStoreId,
          usageBytes: 1024,
          status: 'completed',
          createdAt: new Date(now * 1000),
        });
        await this.db
          .update(vectorStoresTable)
          .set({ fileCounts: store.file_counts })
          .where(eq(vectorStoresTable.id, vectorStoreId));
      } catch (err) {
        console.error('[VectorStoreService] Failed to insert vector store file in DB:', err);
      }
    }

    return fileObj;
  }

  async listFiles(vectorStoreId: string): Promise<OpenAIVectorStoreFileObject[]> {
    const store = await this.getVectorStore(vectorStoreId);
    if (!store) return [];

    let filesMap = this.memoryFiles.get(vectorStoreId);
    if (!filesMap) {
      filesMap = new Map();
      this.memoryFiles.set(vectorStoreId, filesMap);
    }

    if (this.db) {
      try {
        const rows = await this.db
          .select()
          .from(vectorStoreFilesTable)
          .where(eq(vectorStoreFilesTable.vectorStoreId, vectorStoreId));

        for (const row of rows) {
          if (!filesMap.has(row.id)) {
            filesMap.set(row.id, {
              id: row.id,
              object: 'vector_store.file',
              usage_bytes: row.usageBytes,
              created_at: Math.floor(row.createdAt.getTime() / 1000),
              vector_store_id: row.vectorStoreId,
              status: (row.status as any) || 'completed',
              last_error: null,
            });
          }
        }
      } catch (err) {
        console.error('[VectorStoreService] Failed to list vector store files from DB:', err);
      }
    }

    return Array.from(filesMap.values());
  }

  async getFile(vectorStoreId: string, fileId: string): Promise<OpenAIVectorStoreFileObject | null> {
    const files = await this.listFiles(vectorStoreId);
    return files.find((f) => f.id === fileId) || null;
  }

  async removeFile(vectorStoreId: string, fileId: string): Promise<boolean> {
    const store = await this.getVectorStore(vectorStoreId);
    const filesMap = this.memoryFiles.get(vectorStoreId);
    if (filesMap) {
      filesMap.delete(fileId);
    }

    if (store && store.file_counts.total > 0) {
      store.file_counts.total--;
      if (store.file_counts.completed > 0) store.file_counts.completed--;
    }

    if (this.db) {
      try {
        await this.db
          .delete(vectorStoreFilesTable)
          .where(
            and(
              eq(vectorStoreFilesTable.vectorStoreId, vectorStoreId),
              eq(vectorStoreFilesTable.id, fileId)
            )
          );
      } catch (err) {
        console.error('[VectorStoreService] Failed to remove file from DB:', err);
      }
    }

    return true;
  }

  async createFileBatch(
    vectorStoreId: string,
    fileIds: string[]
  ): Promise<OpenAIVectorStoreFileBatchObject | null> {
    const store = await this.getVectorStore(vectorStoreId);
    if (!store) return null;

    const id = this.generateId('vsfb_');
    const now = Math.floor(Date.now() / 1000);

    for (const fileId of fileIds) {
      await this.addFileToStore(vectorStoreId, fileId);
    }

    const batchObj: OpenAIVectorStoreFileBatchObject = {
      id,
      object: 'vector_store.file_batch',
      created_at: now,
      vector_store_id: vectorStoreId,
      status: 'completed',
      file_counts: {
        in_progress: 0,
        completed: fileIds.length,
        failed: 0,
        cancelled: 0,
        total: fileIds.length,
      },
    };

    this.memoryBatches.set(id, batchObj);
    return batchObj;
  }

  async getFileBatch(
    vectorStoreId: string,
    batchId: string
  ): Promise<OpenAIVectorStoreFileBatchObject | null> {
    return this.memoryBatches.get(batchId) || null;
  }
}
