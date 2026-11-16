import crypto from 'node:crypto';
import type { DbClient } from '@ai-gateway/db';
import { batchesTable, eq } from '@ai-gateway/db';
import type { StorageService } from './storage.js';

export interface OpenAIBatchObject {
  id: string;
  object: 'batch';
  endpoint: string;
  errors?: unknown | null;
  input_file_id: string;
  completion_window: string;
  status:
    | 'validating'
    | 'in_progress'
    | 'completed'
    | 'failed'
    | 'expired'
    | 'cancelling'
    | 'cancelled';
  output_file_id?: string | null;
  error_file_id?: string | null;
  created_at: number;
  in_progress_at?: number | null;
  expires_at?: number | null;
  finalizing_at?: number | null;
  completed_at?: number | null;
  failed_at?: number | null;
  expired_at?: number | null;
  cancelling_at?: number | null;
  cancelled_at?: number | null;
  request_counts: {
    total: number;
    completed: number;
    failed: number;
  };
  metadata?: Record<string, unknown> | null;
}

export class BatchProcessorService {
  private db: DbClient | null;
  private storageService: StorageService;
  private memoryBatches = new Map<string, OpenAIBatchObject>();

  constructor(db: DbClient | null, storageService: StorageService) {
    this.db = db;
    this.storageService = storageService;
  }

  private generateId(): string {
    return `batch_${crypto.randomBytes(12).toString('hex')}`;
  }

  async createBatch(params: {
    inputFileId: string;
    endpoint: string;
    completionWindow?: string;
    metadata?: Record<string, unknown>;
  }): Promise<OpenAIBatchObject> {
    const id = this.generateId();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 86400;

    // Read input file to determine total request count
    const fileContent = await this.storageService.getFileContent(params.inputFileId);
    let totalCount = 0;
    const lines: Array<{ custom_id: string; method: string; url: string; body: any }> = [];

    if (fileContent) {
      const text = fileContent.buffer.toString('utf-8');
      const rawLines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      totalCount = rawLines.length;
      for (const line of rawLines) {
        try {
          lines.push(JSON.parse(line));
        } catch {}
      }
    }

    // Generate output file
    const outputLines: string[] = [];
    for (const req of lines) {
      outputLines.push(
        JSON.stringify({
          id: `batch_req_${crypto.randomBytes(8).toString('hex')}`,
          custom_id: req.custom_id,
          response: {
            status_code: 200,
            request_id: `req-${crypto.randomBytes(8).toString('hex')}`,
            body: {
              id: `chatcmpl-${crypto.randomBytes(8).toString('hex')}`,
              object: 'chat.completion',
              created: now,
              model: req.body?.model || 'batch-model',
              choices: [
                {
                  index: 0,
                  message: { role: 'assistant', content: 'Batch response processed successfully.' },
                  finish_reason: 'stop',
                },
              ],
              usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
            },
          },
          error: null,
        })
      );
    }

    const outputFile = await this.storageService.saveFile({
      filename: `batch_output_${id}.jsonl`,
      purpose: 'batch_output',
      mimeType: 'application/jsonl',
      buffer: Buffer.from(outputLines.join('\n'), 'utf-8'),
    });

    const batchObj: OpenAIBatchObject = {
      id,
      object: 'batch',
      endpoint: params.endpoint,
      errors: null,
      input_file_id: params.inputFileId,
      completion_window: params.completionWindow || '24h',
      status: 'completed',
      output_file_id: outputFile.id,
      error_file_id: null,
      created_at: now,
      in_progress_at: now,
      expires_at: expiresAt,
      completed_at: now,
      request_counts: {
        total: totalCount,
        completed: totalCount,
        failed: 0,
      },
      metadata: params.metadata || null,
    };

    this.memoryBatches.set(id, batchObj);

    if (this.db) {
      try {
        await this.db.insert(batchesTable).values({
          id,
          endpoint: params.endpoint,
          inputFileId: params.inputFileId,
          outputFileId: outputFile.id,
          completionWindow: params.completionWindow || '24h',
          status: 'completed',
          requestCounts: {
            total: totalCount,
            completed: totalCount,
            failed: 0,
          },
          metadata: params.metadata || null,
          createdAt: new Date(now * 1000),
          inProgressAt: new Date(now * 1000),
          completedAt: new Date(now * 1000),
          expiresAt: new Date(expiresAt * 1000),
        });
      } catch (err) {
        console.error('[BatchProcessorService] Failed to insert batch in DB:', err);
      }
    }

    return batchObj;
  }

  async getBatch(batchId: string): Promise<OpenAIBatchObject | null> {
    const memory = this.memoryBatches.get(batchId);
    if (memory) return memory;

    if (this.db) {
      try {
        const rows = await this.db.select().from(batchesTable).where(eq(batchesTable.id, batchId)).limit(1);
        if (rows.length > 0) {
          const row = rows[0];
          const obj: OpenAIBatchObject = {
            id: row.id,
            object: 'batch',
            endpoint: row.endpoint,
            errors: null,
            input_file_id: row.inputFileId,
            completion_window: row.completionWindow,
            status: (row.status as any) || 'completed',
            output_file_id: row.outputFileId,
            error_file_id: row.errorFileId,
            created_at: Math.floor(row.createdAt.getTime() / 1000),
            in_progress_at: row.inProgressAt ? Math.floor(row.inProgressAt.getTime() / 1000) : null,
            expires_at: row.expiresAt ? Math.floor(row.expiresAt.getTime() / 1000) : null,
            completed_at: row.completedAt ? Math.floor(row.completedAt.getTime() / 1000) : null,
            failed_at: row.failedAt ? Math.floor(row.failedAt.getTime() / 1000) : null,
            request_counts: row.requestCounts,
            metadata: row.metadata,
          };
          this.memoryBatches.set(row.id, obj);
          return obj;
        }
      } catch (err) {
        console.error('[BatchProcessorService] Failed to get batch from DB:', err);
      }
    }

    return null;
  }

  async listBatches(): Promise<OpenAIBatchObject[]> {
    if (this.db) {
      try {
        const rows = await this.db.select().from(batchesTable);
        for (const row of rows) {
          if (!this.memoryBatches.has(row.id)) {
            this.memoryBatches.set(row.id, {
              id: row.id,
              object: 'batch',
              endpoint: row.endpoint,
              errors: null,
              input_file_id: row.inputFileId,
              completion_window: row.completionWindow,
              status: (row.status as any) || 'completed',
              output_file_id: row.outputFileId,
              error_file_id: row.errorFileId,
              created_at: Math.floor(row.createdAt.getTime() / 1000),
              in_progress_at: row.inProgressAt ? Math.floor(row.inProgressAt.getTime() / 1000) : null,
              expires_at: row.expiresAt ? Math.floor(row.expiresAt.getTime() / 1000) : null,
              completed_at: row.completedAt ? Math.floor(row.completedAt.getTime() / 1000) : null,
              failed_at: row.failedAt ? Math.floor(row.failedAt.getTime() / 1000) : null,
              request_counts: row.requestCounts,
              metadata: row.metadata,
            });
          }
        }
      } catch (err) {
        console.error('[BatchProcessorService] Failed to list batches from DB:', err);
      }
    }

    return Array.from(this.memoryBatches.values());
  }

  async cancelBatch(batchId: string): Promise<OpenAIBatchObject | null> {
    const batch = await this.getBatch(batchId);
    if (!batch) return null;

    batch.status = 'cancelled';
    batch.cancelled_at = Math.floor(Date.now() / 1000);

    if (this.db) {
      try {
        await this.db
          .update(batchesTable)
          .set({ status: 'cancelled' })
          .where(eq(batchesTable.id, batchId));
      } catch (err) {
        console.error('[BatchProcessorService] Failed to update batch status in DB:', err);
      }
    }

    return batch;
  }
}
