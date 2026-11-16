import type { RequestTelemetry } from '@ai-gateway/core';
import type { DbClient } from '@ai-gateway/db';
import { requestLogsTable } from '@ai-gateway/db';
import crypto from 'node:crypto';

export class TelemetryQueue {
  private queue: RequestTelemetry[] = [];
  private db: DbClient | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private batchSize = 50;

  constructor(db: DbClient | null) {
    this.db = db;
    this.startWorker();
  }

  setDb(db: DbClient | null): void {
    this.db = db;
  }

  enqueue(log: Omit<RequestTelemetry, 'id'>): void {
    const item: RequestTelemetry = {
      ...log,
      id: crypto.randomUUID(),
    };
    this.queue.push(item);
    if (this.queue.length >= this.batchSize) {
      void this.flush();
    }
  }

  private startWorker(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, 2000);
    this.flushTimer.unref();
  }

  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0 || !this.db) {
      return;
    }

    this.isFlushing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      await this.db.insert(requestLogsTable).values(
        batch.map((b) => ({
          id: b.id!,
          timestamp: b.timestamp,
          modelSlug: b.modelSlug,
          providerId: b.providerId,
          gatewayKeyId: b.gatewayKeyId ?? null,
          statusCode: b.statusCode,
          isStreaming: b.isStreaming,
          ttftMs: b.ttftMs ?? null,
          latencyMs: b.latencyMs,
          promptTokens: b.promptTokens ?? null,
          completionTokens: b.completionTokens ?? null,
          errorMessage: b.errorMessage ?? null,
        }))
      );
    } catch (err) {
      // Non-blocking telemetry error logging
      console.error('[TelemetryQueue] Failed to persist batch logs:', err);
    } finally {
      this.isFlushing = false;
    }
  }

  close(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    void this.flush();
  }
}
