import crypto from 'node:crypto';
import type { DbClient } from '@ai-gateway/db';
import { conversationsTable, conversationItemsTable, responsesTable, eq } from '@ai-gateway/db';
import type { ProviderAdapter, ProviderConfig, UnifiedModel, OpenAIChatMessage } from '@ai-gateway/core';

export interface OpenAIResponseObject {
  id: string;
  object: 'response';
  created_at: number;
  status: 'completed' | 'in_progress' | 'failed' | 'cancelled';
  model: string;
  output: Array<{
    id: string;
    type: 'message';
    role: 'assistant';
    content: Array<{ type: 'output_text'; text: string }>;
  }>;
  output_text: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  metadata?: Record<string, unknown> | null;
}

export interface ConversationItem {
  id: string;
  role: string;
  content: string;
  created_at: number;
}

export interface ConversationObject {
  id: string;
  object: 'conversation';
  created_at: number;
  metadata?: Record<string, unknown> | null;
  items: ConversationItem[];
}

export class ResponsesEngineService {
  private db: DbClient | null;
  private memoryResponses = new Map<string, OpenAIResponseObject & { inputText: string }>();
  private memoryConversations = new Map<string, ConversationObject>();

  constructor(db: DbClient | null) {
    this.db = db;
  }

  private generateId(prefix: string): string {
    return `${prefix}${crypto.randomBytes(12).toString('hex')}`;
  }

  async generateResponse(params: {
    model: UnifiedModel;
    provider: ProviderConfig;
    adapter: ProviderAdapter;
    input: string | any[];
    previousResponseId?: string;
    conversationId?: string;
    instructions?: string;
    stream?: boolean;
    signal?: AbortSignal;
  }): Promise<{ isStream: false; data: OpenAIResponseObject } | { isStream: true; stream: NodeJS.ReadableStream | ReadableStream }> {
    const now = Math.floor(Date.now() / 1000);
    const respId = this.generateId('resp_');

    // 1. Build context messages
    const messages: OpenAIChatMessage[] = [];

    if (params.instructions) {
      messages.push({ role: 'system', content: params.instructions });
    }

    if (params.conversationId) {
      const conv = await this.getConversation(params.conversationId);
      if (conv) {
        for (const it of conv.items) {
          messages.push({ role: it.role as any, content: it.content });
        }
      }
    } else if (params.previousResponseId) {
      const prev = this.memoryResponses.get(params.previousResponseId);
      if (prev) {
        messages.push({ role: 'user', content: prev.inputText });
        messages.push({ role: 'assistant', content: prev.output_text });
      }
    }

    const currentInputText = typeof params.input === 'string'
      ? params.input
      : JSON.stringify(params.input);

    messages.push({ role: 'user', content: currentInputText });

    // 2. Call upstream adapter
    if (!params.adapter.chatCompletions) {
      throw new Error(`Provider adapter ${params.adapter.id} does not support chatCompletions.`);
    }

    const upstreamResponse = await params.adapter.chatCompletions(
      {
        model: params.model.id,
        messages,
        stream: params.stream,
      },
      params.provider,
      params.signal
    );

    if (!upstreamResponse.ok) {
      const errText = await upstreamResponse.text().catch(() => 'Upstream completion error');
      throw new Error(`Upstream error (${upstreamResponse.status}): ${errText}`);
    }

    // 3. Handle Streaming Response
    if (params.stream) {
      const msgId = this.generateId('msg_');
      const textDecoder = new TextDecoder();
      const textEncoder = new TextEncoder();

      const upstreamBody = upstreamResponse.body;
      if (!upstreamBody) {
        throw new Error('Upstream response body is null in streaming mode.');
      }

      let accumulatedText = '';
      const reader = (upstreamBody as any).getReader();

      const transformedStream = new ReadableStream({
        async start(controller) {
          // Send response.created
          const initialEnvelope = {
            type: 'response.created',
            response: {
              id: respId,
              object: 'response',
              created_at: now,
              status: 'in_progress',
              model: params.model.id,
              output: [],
              output_text: '',
            },
          };
          controller.enqueue(textEncoder.encode(`event: response.created\ndata: ${JSON.stringify(initialEnvelope)}\n\n`));

          // Send response.output_item.added
          const outputItemAdded = {
            type: 'response.output_item.added',
            output_index: 0,
            item: {
              id: msgId,
              type: 'message',
              role: 'assistant',
              content: [],
            },
          };
          controller.enqueue(textEncoder.encode(`event: response.output_item.added\ndata: ${JSON.stringify(outputItemAdded)}\n\n`));

          // Read upstream chunks
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += textDecoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data:')) continue;
              const payload = trimmed.replace(/^data:\s*/, '');
              if (payload === '[DONE]') continue;

              try {
                const parsed = JSON.parse(payload);
                const delta = parsed.choices?.[0]?.delta?.content || '';
                if (delta) {
                  accumulatedText += delta;
                  const deltaEnvelope = {
                    type: 'response.output_text.delta',
                    output_index: 0,
                    content_index: 0,
                    delta,
                  };
                  controller.enqueue(textEncoder.encode(`event: response.output_text.delta\ndata: ${JSON.stringify(deltaEnvelope)}\n\n`));
                }
              } catch {}
            }
          }

          // Send response.completed
          const completedEnvelope = {
            type: 'response.completed',
            response: {
              id: respId,
              object: 'response',
              created_at: now,
              status: 'completed',
              model: params.model.id,
              output: [
                {
                  id: msgId,
                  type: 'message',
                  role: 'assistant',
                  content: [{ type: 'output_text', text: accumulatedText }],
                },
              ],
              output_text: accumulatedText,
            },
          };
          controller.enqueue(textEncoder.encode(`event: response.completed\ndata: ${JSON.stringify(completedEnvelope)}\n\n`));
          controller.enqueue(textEncoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      return { isStream: true, stream: transformedStream };
    }

    // 4. Handle Non-Streaming Response
    const json = (await upstreamResponse.json()) as any;
    const outputText = json.choices?.[0]?.message?.content || '';
    const msgId = this.generateId('msg_');

    const responseObj: OpenAIResponseObject = {
      id: respId,
      object: 'response',
      created_at: now,
      status: 'completed',
      model: params.model.id,
      output: [
        {
          id: msgId,
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: outputText }],
        },
      ],
      output_text: outputText,
      usage: json.usage || { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    };

    this.memoryResponses.set(respId, {
      ...responseObj,
      inputText: currentInputText,
    });

    if (params.conversationId) {
      await this.addConversationItem(params.conversationId, { role: 'user', content: currentInputText });
      await this.addConversationItem(params.conversationId, { role: 'assistant', content: outputText });
    }

    if (this.db) {
      try {
        await this.db.insert(responsesTable).values({
          id: respId,
          conversationId: params.conversationId || null,
          model: params.model.id,
          status: 'completed',
          outputText,
          usage: responseObj.usage,
          createdAt: new Date(now * 1000),
        });
      } catch (err) {
        console.error('[ResponsesEngineService] Failed to insert response in DB:', err);
      }
    }

    return { isStream: false, data: responseObj };
  }

  async getResponse(id: string): Promise<OpenAIResponseObject | null> {
    const memory = this.memoryResponses.get(id);
    if (memory) {
      const { inputText, ...rest } = memory;
      return rest;
    }
    return null;
  }

  async deleteResponse(id: string): Promise<boolean> {
    this.memoryResponses.delete(id);
    if (this.db) {
      try {
        await this.db.delete(responsesTable).where(eq(responsesTable.id, id));
      } catch {}
    }
    return true;
  }

  async createConversation(metadata?: Record<string, unknown>): Promise<ConversationObject> {
    const id = this.generateId('conv_');
    const now = Math.floor(Date.now() / 1000);
    const conv: ConversationObject = {
      id,
      object: 'conversation',
      created_at: now,
      metadata: metadata || null,
      items: [],
    };

    this.memoryConversations.set(id, conv);

    if (this.db) {
      try {
        await this.db.insert(conversationsTable).values({
          id,
          metadata: metadata || null,
          createdAt: new Date(now * 1000),
        });
      } catch (err) {
        console.error('[ResponsesEngineService] Failed to insert conversation in DB:', err);
      }
    }

    return conv;
  }

  async getConversation(id: string): Promise<ConversationObject | null> {
    return this.memoryConversations.get(id) || null;
  }

  async addConversationItem(
    convId: string,
    item: { role: string; content: string }
  ): Promise<ConversationItem | null> {
    const conv = this.memoryConversations.get(convId);
    if (!conv) return null;

    const itemId = this.generateId('item_');
    const now = Math.floor(Date.now() / 1000);
    const convItem: ConversationItem = {
      id: itemId,
      role: item.role,
      content: item.content,
      created_at: now,
    };

    conv.items.push(convItem);

    if (this.db) {
      try {
        await this.db.insert(conversationItemsTable).values({
          id: itemId,
          conversationId: convId,
          role: item.role,
          content: item.content,
          createdAt: new Date(now * 1000),
        });
      } catch (err) {
        console.error('[ResponsesEngineService] Failed to insert conversation item in DB:', err);
      }
    }

    return convItem;
  }

  async deleteConversation(id: string): Promise<boolean> {
    this.memoryConversations.delete(id);
    if (this.db) {
      try {
        await this.db.delete(conversationsTable).where(eq(conversationsTable.id, id));
      } catch {}
    }
    return true;
  }
}
