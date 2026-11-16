import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { DbClient } from '@ai-gateway/db';
import { filesTable, uploadsTable, uploadPartsTable, eq } from '@ai-gateway/db';

export interface OpenAIFileObject {
  id: string;
  object: 'file';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  status: 'uploaded' | 'processed' | 'error';
  status_details?: string | null;
}

export interface OpenAIUploadObject {
  id: string;
  object: 'upload';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  status: 'pending' | 'completed' | 'cancelled';
  expires_at: number;
}

export interface OpenAIUploadPartObject {
  id: string;
  object: 'upload.part';
  created_at: number;
  upload_id: string;
}

interface StoredFileMeta extends OpenAIFileObject {
  storagePath: string;
  mimeType: string;
}

interface StoredUploadMeta extends OpenAIUploadObject {
  mimeType: string;
  parts: Array<{ id: string; storagePath: string; buffer: Buffer }>;
}

export class StorageService {
  private baseDir: string;
  private db: DbClient | null;
  // Fallback in-memory map for testing or standalone mode
  private memoryFiles = new Map<string, StoredFileMeta>();
  private memoryUploads = new Map<string, StoredUploadMeta>();

  constructor(db: DbClient | null, baseDir?: string) {
    this.db = db;
    this.baseDir = baseDir || path.resolve(process.cwd(), '.data/storage');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}${crypto.randomBytes(12).toString('hex')}`;
  }

  async saveFile(params: {
    filename: string;
    purpose: string;
    mimeType?: string;
    buffer: Buffer;
  }): Promise<OpenAIFileObject> {
    const id = this.generateId('file-');
    const storagePath = path.join(this.baseDir, `${id}_${path.basename(params.filename)}`);
    await fs.promises.writeFile(storagePath, params.buffer);

    const now = Math.floor(Date.now() / 1000);
    const fileObj: OpenAIFileObject = {
      id,
      object: 'file',
      bytes: params.buffer.length,
      created_at: now,
      filename: params.filename,
      purpose: params.purpose,
      status: 'processed',
      status_details: null,
    };

    const meta: StoredFileMeta = {
      ...fileObj,
      storagePath,
      mimeType: params.mimeType || 'application/octet-stream',
    };

    this.memoryFiles.set(id, meta);

    if (this.db) {
      try {
        await this.db.insert(filesTable).values({
          id,
          bytes: params.buffer.length,
          createdAt: new Date(now * 1000),
          filename: params.filename,
          purpose: params.purpose,
          storagePath,
          mimeType: params.mimeType || 'application/octet-stream',
          status: 'processed',
        });
      } catch (err) {
        console.error('[StorageService] Failed to persist file in DB:', err);
      }
    }

    return fileObj;
  }

  async listFiles(purpose?: string): Promise<OpenAIFileObject[]> {
    let files = Array.from(this.memoryFiles.values());
    if (this.db) {
      try {
        const rows = await this.db.select().from(filesTable);
        for (const row of rows) {
          if (!this.memoryFiles.has(row.id)) {
            this.memoryFiles.set(row.id, {
              id: row.id,
              object: 'file',
              bytes: row.bytes,
              created_at: Math.floor(row.createdAt.getTime() / 1000),
              filename: row.filename,
              purpose: row.purpose,
              status: (row.status as 'uploaded' | 'processed' | 'error') || 'processed',
              status_details: row.statusDetails,
              storagePath: row.storagePath,
              mimeType: row.mimeType,
            });
          }
        }
        files = Array.from(this.memoryFiles.values());
      } catch (err) {
        console.error('[StorageService] Failed to list files from DB:', err);
      }
    }

    if (purpose) {
      files = files.filter((f) => f.purpose === purpose);
    }

    return files.map(({ storagePath, mimeType, ...rest }) => rest);
  }

  async getFile(fileId: string): Promise<OpenAIFileObject | null> {
    const meta = this.memoryFiles.get(fileId);
    if (meta) {
      const { storagePath, mimeType, ...rest } = meta;
      return rest;
    }

    if (this.db) {
      try {
        const rows = await this.db.select().from(filesTable).where(eq(filesTable.id, fileId)).limit(1);
        if (rows.length > 0) {
          const row = rows[0];
          const newMeta: StoredFileMeta = {
            id: row.id,
            object: 'file',
            bytes: row.bytes,
            created_at: Math.floor(row.createdAt.getTime() / 1000),
            filename: row.filename,
            purpose: row.purpose,
            status: (row.status as 'uploaded' | 'processed' | 'error') || 'processed',
            status_details: row.statusDetails,
            storagePath: row.storagePath,
            mimeType: row.mimeType,
          };
          this.memoryFiles.set(row.id, newMeta);
          const { storagePath, mimeType, ...rest } = newMeta;
          return rest;
        }
      } catch (err) {
        console.error('[StorageService] Failed to get file from DB:', err);
      }
    }

    return null;
  }

  async getFileContent(fileId: string): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
    let meta = this.memoryFiles.get(fileId);
    if (!meta && this.db) {
      await this.getFile(fileId);
      meta = this.memoryFiles.get(fileId);
    }

    if (!meta) return null;

    try {
      const buffer = await fs.promises.readFile(meta.storagePath);
      return { buffer, mimeType: meta.mimeType, filename: meta.filename };
    } catch (err) {
      console.error(`[StorageService] Failed to read file content for ${fileId}:`, err);
      return null;
    }
  }

  async deleteFile(fileId: string): Promise<boolean> {
    const meta = this.memoryFiles.get(fileId);
    if (meta) {
      try {
        if (fs.existsSync(meta.storagePath)) {
          await fs.promises.unlink(meta.storagePath);
        }
      } catch {}
      this.memoryFiles.delete(fileId);
    }

    if (this.db) {
      try {
        await this.db.delete(filesTable).where(eq(filesTable.id, fileId));
      } catch (err) {
        console.error('[StorageService] Failed to delete file in DB:', err);
      }
    }

    return true;
  }

  async createUpload(params: {
    filename: string;
    purpose: string;
    bytes: number;
    mimeType?: string;
  }): Promise<OpenAIUploadObject> {
    const id = this.generateId('upload_');
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 86400; // 24 hours

    const uploadObj: OpenAIUploadObject = {
      id,
      object: 'upload',
      bytes: params.bytes,
      created_at: now,
      filename: params.filename,
      purpose: params.purpose,
      status: 'pending',
      expires_at: expiresAt,
    };

    const meta: StoredUploadMeta = {
      ...uploadObj,
      mimeType: params.mimeType || 'application/octet-stream',
      parts: [],
    };

    this.memoryUploads.set(id, meta);

    if (this.db) {
      try {
        await this.db.insert(uploadsTable).values({
          id,
          bytes: params.bytes,
          createdAt: new Date(now * 1000),
          filename: params.filename,
          purpose: params.purpose,
          mimeType: params.mimeType || 'application/octet-stream',
          status: 'pending',
          expiresAt: new Date(expiresAt * 1000),
        });
      } catch (err) {
        console.error('[StorageService] Failed to insert upload in DB:', err);
      }
    }

    return uploadObj;
  }

  async addUploadPart(uploadId: string, buffer: Buffer): Promise<OpenAIUploadPartObject | null> {
    const upload = this.memoryUploads.get(uploadId);
    if (!upload || upload.status !== 'pending') {
      return null;
    }

    const partId = this.generateId('part_');
    const storagePath = path.join(this.baseDir, `${uploadId}_${partId}.part`);
    await fs.promises.writeFile(storagePath, buffer);

    const now = Math.floor(Date.now() / 1000);
    upload.parts.push({ id: partId, storagePath, buffer });

    if (this.db) {
      try {
        await this.db.insert(uploadPartsTable).values({
          id: partId,
          uploadId,
          storagePath,
          createdAt: new Date(now * 1000),
        });
      } catch (err) {
        console.error('[StorageService] Failed to insert upload part in DB:', err);
      }
    }

    return {
      id: partId,
      object: 'upload.part',
      created_at: now,
      upload_id: uploadId,
    };
  }

  async completeUpload(uploadId: string, partIds: string[]): Promise<OpenAIFileObject | null> {
    const upload = this.memoryUploads.get(uploadId);
    if (!upload || upload.status !== 'pending') {
      return null;
    }

    // Assemble parts in ordered sequence
    const orderedBuffers: Buffer[] = [];
    for (const pid of partIds) {
      const part = upload.parts.find((p) => p.id === pid);
      if (part) {
        orderedBuffers.push(part.buffer);
      }
    }

    const finalBuffer = Buffer.concat(orderedBuffers);
    const file = await this.saveFile({
      filename: upload.filename,
      purpose: upload.purpose,
      mimeType: upload.mimeType,
      buffer: finalBuffer,
    });

    upload.status = 'completed';

    // Cleanup part temp files
    for (const part of upload.parts) {
      try {
        if (fs.existsSync(part.storagePath)) {
          await fs.promises.unlink(part.storagePath);
        }
      } catch {}
    }

    return file;
  }

  async cancelUpload(uploadId: string): Promise<boolean> {
    const upload = this.memoryUploads.get(uploadId);
    if (upload) {
      upload.status = 'cancelled';
      for (const part of upload.parts) {
        try {
          if (fs.existsSync(part.storagePath)) {
            await fs.promises.unlink(part.storagePath);
          }
        } catch {}
      }
    }
    return true;
  }
}
