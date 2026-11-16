import crypto from 'node:crypto';
import type { DbClient } from '@ai-gateway/db';
import {
  assistantsTable,
  threadsTable,
  threadMessagesTable,
  runsTable,
  eq,
} from '@ai-gateway/db';
import type { ProviderAdapter, ProviderConfig, UnifiedModel, OpenAIChatMessage } from '@ai-gateway/core';

export interface OpenAIAssistantObject {
  id: string;
  object: 'assistant';
  created_at: number;
  name?: string | null;
  description?: string | null;
  model: string;
  instructions?: string | null;
  tools: Array<{ type: string; [key: string]: unknown }>;
  tool_resources?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface OpenAIThreadObject {
  id: string;
  object: 'thread';
  created_at: number;
  metadata?: Record<string, unknown> | null;
  tool_resources?: Record<string, unknown> | null;
}

export interface OpenAIThreadMessageObject {
  id: string;
  object: 'thread.message';
  created_at: number;
  thread_id: string;
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text';
    text: { value: string; annotations: any[] };
  }>;
  assistant_id?: string | null;
  run_id?: string | null;
  attachments?: any[];
  metadata?: Record<string, unknown> | null;
}

export interface OpenAIRunObject {
  id: string;
  object: 'thread.run';
  created_at: number;
  thread_id: string;
  assistant_id: string;
  status:
    | 'queued'
    | 'in_progress'
    | 'requires_action'
    | 'cancelling'
    | 'cancelled'
    | 'failed'
    | 'completed'
    | 'expired';
  started_at?: number | null;
  completed_at?: number | null;
  model: string;
  instructions?: string | null;
  tools: Array<{ type: string }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
}

export class AssistantRunnerService {
  private db: DbClient | null;
  private memoryAssistants = new Map<string, OpenAIAssistantObject>();
  private memoryThreads = new Map<string, OpenAIThreadObject>();
  private memoryMessages = new Map<string, OpenAIThreadMessageObject[]>(); // threadId -> messages
  private memoryRuns = new Map<string, OpenAIRunObject>();

  constructor(db: DbClient | null) {
    this.db = db;
  }

  private generateId(prefix: string): string {
    return `${prefix}${crypto.randomBytes(12).toString('hex')}`;
  }

  // --- Assistants CRUD ---
  async createAssistant(params: {
    model: string;
    name?: string;
    description?: string;
    instructions?: string;
    tools?: Array<{ type: string }>;
    toolResources?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<OpenAIAssistantObject> {
    const id = this.generateId('asst_');
    const now = Math.floor(Date.now() / 1000);

    const asst: OpenAIAssistantObject = {
      id,
      object: 'assistant',
      created_at: now,
      name: params.name || null,
      description: params.description || null,
      model: params.model,
      instructions: params.instructions || null,
      tools: params.tools || [],
      tool_resources: params.toolResources || null,
      metadata: params.metadata || null,
    };

    this.memoryAssistants.set(id, asst);

    if (this.db) {
      try {
        await this.db.insert(assistantsTable).values({
          id,
          name: asst.name,
          model: asst.model,
          instructions: asst.instructions,
          tools: asst.tools,
          toolResources: asst.tool_resources || null,
          metadata: asst.metadata || null,
          createdAt: new Date(now * 1000),
        });
      } catch (err) {
        console.error('[AssistantRunnerService] Failed to insert assistant into DB:', err);
      }
    }

    return asst;
  }

  async listAssistants(): Promise<OpenAIAssistantObject[]> {
    if (this.db) {
      try {
        const rows = await this.db.select().from(assistantsTable);
        for (const row of rows) {
          if (!this.memoryAssistants.has(row.id)) {
            this.memoryAssistants.set(row.id, {
              id: row.id,
              object: 'assistant',
              created_at: Math.floor(row.createdAt.getTime() / 1000),
              name: row.name,
              model: row.model,
              instructions: row.instructions,
              tools: row.tools || [],
              tool_resources: row.toolResources || null,
              metadata: row.metadata,
            });
          }
        }
      } catch (err) {
        console.error('[AssistantRunnerService] Failed to list assistants from DB:', err);
      }
    }
    return Array.from(this.memoryAssistants.values());
  }

  async getAssistant(id: string): Promise<OpenAIAssistantObject | null> {
    const memory = this.memoryAssistants.get(id);
    if (memory) return memory;

    if (this.db) {
      try {
        const rows = await this.db.select().from(assistantsTable).where(eq(assistantsTable.id, id)).limit(1);
        if (rows.length > 0) {
          const row = rows[0];
          const obj: OpenAIAssistantObject = {
            id: row.id,
            object: 'assistant',
            created_at: Math.floor(row.createdAt.getTime() / 1000),
            name: row.name,
            model: row.model,
            instructions: row.instructions,
            tools: row.tools || [],
            tool_resources: row.toolResources || null,
            metadata: row.metadata,
          };
          this.memoryAssistants.set(row.id, obj);
          return obj;
        }
      } catch (err) {
        console.error('[AssistantRunnerService] Failed to get assistant from DB:', err);
      }
    }
    return null;
  }

  async updateAssistant(
    id: string,
    params: Partial<{ name: string; instructions: string; model: string; metadata: Record<string, unknown> }>
  ): Promise<OpenAIAssistantObject | null> {
    const asst = await this.getAssistant(id);
    if (!asst) return null;

    if (params.name !== undefined) asst.name = params.name;
    if (params.instructions !== undefined) asst.instructions = params.instructions;
    if (params.model !== undefined) asst.model = params.model;
    if (params.metadata !== undefined) asst.metadata = params.metadata;

    if (this.db) {
      try {
        await this.db
          .update(assistantsTable)
          .set({
            name: asst.name,
            instructions: asst.instructions,
            model: asst.model,
            metadata: asst.metadata || null,
          })
          .where(eq(assistantsTable.id, id));
      } catch (err) {
        console.error('[AssistantRunnerService] Failed to update assistant in DB:', err);
      }
    }

    return asst;
  }

  async deleteAssistant(id: string): Promise<boolean> {
    this.memoryAssistants.delete(id);
    if (this.db) {
      try {
        await this.db.delete(assistantsTable).where(eq(assistantsTable.id, id));
      } catch {}
    }
    return true;
  }

  // --- Threads CRUD ---
  async createThread(params?: { metadata?: Record<string, unknown> }): Promise<OpenAIThreadObject> {
    const id = this.generateId('thread_');
    const now = Math.floor(Date.now() / 1000);
    const thread: OpenAIThreadObject = {
      id,
      object: 'thread',
      created_at: now,
      metadata: params?.metadata || null,
      tool_resources: {},
    };

    this.memoryThreads.set(id, thread);
    this.memoryMessages.set(id, []);

    if (this.db) {
      try {
        await this.db.insert(threadsTable).values({
          id,
          metadata: thread.metadata || null,
          createdAt: new Date(now * 1000),
        });
      } catch (err) {
        console.error('[AssistantRunnerService] Failed to insert thread into DB:', err);
      }
    }

    return thread;
  }

  async getThread(id: string): Promise<OpenAIThreadObject | null> {
    return this.memoryThreads.get(id) || null;
  }

  async deleteThread(id: string): Promise<boolean> {
    this.memoryThreads.delete(id);
    this.memoryMessages.delete(id);
    if (this.db) {
      try {
        await this.db.delete(threadsTable).where(eq(threadsTable.id, id));
      } catch {}
    }
    return true;
  }

  // --- Thread Messages ---
  async createMessage(
    threadId: string,
    params: { role: 'user' | 'assistant'; content: string }
  ): Promise<OpenAIThreadMessageObject> {
    const id = this.generateId('msg_');
    const now = Math.floor(Date.now() / 1000);

    const msg: OpenAIThreadMessageObject = {
      id,
      object: 'thread.message',
      created_at: now,
      thread_id: threadId,
      role: params.role,
      content: [
        {
          type: 'text',
          text: { value: params.content, annotations: [] },
        },
      ],
      assistant_id: null,
      run_id: null,
      attachments: [],
      metadata: null,
    };

    let list = this.memoryMessages.get(threadId);
    if (!list) {
      list = [];
      this.memoryMessages.set(threadId, list);
    }
    list.push(msg);

    if (this.db) {
      try {
        await this.db.insert(threadMessagesTable).values({
          id,
          threadId,
          role: params.role,
          content: msg.content,
          createdAt: new Date(now * 1000),
        });
      } catch (err) {
        console.error('[AssistantRunnerService] Failed to insert thread message into DB:', err);
      }
    }

    return msg;
  }

  async listMessages(threadId: string): Promise<OpenAIThreadMessageObject[]> {
    return this.memoryMessages.get(threadId) || [];
  }

  // --- Runs Engine ---
  async createRun(
    threadId: string,
    params: {
      assistantId?: string;
      model: UnifiedModel;
      provider: ProviderConfig;
      adapter: ProviderAdapter;
      instructions?: string;
    }
  ): Promise<OpenAIRunObject> {
    const runId = this.generateId('run_');
    const now = Math.floor(Date.now() / 1000);

    const runObj: OpenAIRunObject = {
      id: runId,
      object: 'thread.run',
      created_at: now,
      thread_id: threadId,
      assistant_id: params.assistantId || 'asst_default',
      status: 'in_progress',
      started_at: now,
      model: params.model.id,
      instructions: params.instructions || null,
      tools: [],
    };

    this.memoryRuns.set(runId, runObj);

    // Build chat message history from thread
    const threadMsgs = await this.listMessages(threadId);
    const messages: OpenAIChatMessage[] = [];

    if (params.instructions) {
      messages.push({ role: 'system', content: params.instructions });
    }

    for (const msg of threadMsgs) {
      const text = msg.content[0]?.text?.value || '';
      messages.push({ role: msg.role, content: text });
    }

    // Call model
    if (!params.adapter.chatCompletions) {
      throw new Error(`Provider adapter ${params.adapter.id} does not support chatCompletions.`);
    }

    const upstreamResponse = await params.adapter.chatCompletions(
      {
        model: params.model.id,
        messages,
        stream: false,
      },
      params.provider
    );

    if (!upstreamResponse.ok) {
      runObj.status = 'failed';
      throw new Error(`Upstream run failed with status ${upstreamResponse.status}`);
    }

    const json = await upstreamResponse.json();
    const assistantContent = json.choices?.[0]?.message?.content || 'Task completed.';

    // Append assistant response to thread messages
    await this.createMessage(threadId, {
      role: 'assistant',
      content: assistantContent,
    });

    runObj.status = 'completed';
    runObj.completed_at = Math.floor(Date.now() / 1000);
    runObj.usage = json.usage || { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 };

    if (this.db) {
      try {
        await this.db.insert(runsTable).values({
          id: runId,
          threadId,
          assistantId: runObj.assistant_id,
          model: params.model.id,
          status: 'completed',
          instructions: runObj.instructions,
          tools: [],
          usage: runObj.usage,
          createdAt: new Date(now * 1000),
        });
      } catch (err) {
        console.error('[AssistantRunnerService] Failed to insert run in DB:', err);
      }
    }

    return runObj;
  }

  async getRun(runId: string): Promise<OpenAIRunObject | null> {
    return this.memoryRuns.get(runId) || null;
  }
}
