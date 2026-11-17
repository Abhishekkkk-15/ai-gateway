import crypto from 'node:crypto';
import type { DbClient } from '@ai-gateway/db';
import type {
  ProviderAdapter,
  ProviderConfig,
  UnifiedModel,
  OpenAIChatMessage,
  OpenAIChatCompletionRequest,
} from '@ai-gateway/core';

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

const FILE_ID_UNSUPPORTED =
  'Uploaded files / file_id are not supported in stateless mode. Inline text or image_url (https or data: base64) in the request instead.';

export class ResponsesEngineService {
  // db kept for server wiring compatibility; intentionally unused (stateless)
  constructor(_db: DbClient | null) {}

  private generateId(prefix: string): string {
    return `${prefix}${crypto.randomBytes(12).toString('hex')}`;
  }

  /**
   * Normalize Responses `input` into chat messages for a single request.
   * Preserves multimodal parts (text + image_url). Rejects file_id references.
   * Stateful multi-turn (previous_response_id / conversation) is rejected at the route layer.
   */
  buildMessagesFromInput(
    input: string | unknown[],
    instructions?: string
  ): OpenAIChatMessage[] {
    const messages: OpenAIChatMessage[] = [];

    if (instructions) {
      messages.push({ role: 'system', content: instructions });
    }

    if (typeof input === 'string') {
      messages.push({ role: 'user', content: input });
      return messages;
    }

    if (!Array.isArray(input)) {
      throw new Error('The input parameter must be a string or an array of input items.');
    }

    for (const item of input) {
      if (item == null) continue;

      if (typeof item === 'string') {
        messages.push({ role: 'user', content: item });
        continue;
      }

      if (typeof item !== 'object') {
        throw new Error('Unsupported input item type in Responses request.');
      }

      const obj = item as Record<string, unknown>;

      if (obj.type === 'input_file' || obj.file_id != null) {
        throw new Error(FILE_ID_UNSUPPORTED);
      }

      if (obj.type === 'input_text' && typeof obj.text === 'string') {
        messages.push({ role: 'user', content: obj.text });
        continue;
      }

      if (obj.type === 'input_image' || obj.type === 'image_url' || obj.type === 'image') {
        messages.push({ role: 'user', content: this.mapContentParts([obj]) });
        continue;
      }

      // OpenAI Responses message / role-shaped items
      if (obj.type === 'message' || obj.role) {
        const role = (obj.role as OpenAIChatMessage['role']) || 'user';
        const content = this.mapContentParts(obj.content);
        messages.push({ role, content });
        continue;
      }

      // Fallback: stringify unknown structured items as user text
      messages.push({ role: 'user', content: JSON.stringify(obj) });
    }

    if (messages.filter((m) => m.role !== 'system').length === 0) {
      throw new Error('The input parameter is required and cannot be empty.');
    }

    return messages;
  }

  /**
   * Map Responses / chat content into chat-completions content (string or parts array).
   * Inline images become `{ type: 'image_url', image_url: { url } }`.
   */
  mapContentParts(content: unknown): string | unknown[] {
    if (typeof content === 'string') return content;
    if (content == null) return '';

    const rawParts = Array.isArray(content) ? content : [content];
    const parts: unknown[] = [];

    for (const part of rawParts) {
      if (typeof part === 'string') {
        parts.push({ type: 'text', text: part });
        continue;
      }
      if (!part || typeof part !== 'object') continue;

      const p = part as Record<string, unknown>;

      if (p.file_id != null || p.type === 'input_file' || p.type === 'file') {
        throw new Error(FILE_ID_UNSUPPORTED);
      }

      if (
        p.type === 'input_text' ||
        p.type === 'text' ||
        p.type === 'output_text'
      ) {
        parts.push({ type: 'text', text: String(p.text ?? '') });
        continue;
      }

      if (p.type === 'input_image' || p.type === 'image_url' || p.type === 'image') {
        const url = this.extractImageUrl(p);
        if (!url) {
          throw new Error('input_image requires image_url or url (https or data:).');
        }
        parts.push({ type: 'image_url', image_url: { url } });
        continue;
      }

      // Pass through already chat-shaped or unknown OpenAI parts
      parts.push(p);
    }

    if (parts.length === 0) return '';
    if (
      parts.length === 1 &&
      typeof parts[0] === 'object' &&
      parts[0] !== null &&
      (parts[0] as Record<string, unknown>).type === 'text'
    ) {
      return String((parts[0] as Record<string, unknown>).text ?? '');
    }
    return parts;
  }

  private extractImageUrl(p: Record<string, unknown>): string | null {
    if (typeof p.image_url === 'string') return p.image_url;
    if (
      p.image_url &&
      typeof p.image_url === 'object' &&
      typeof (p.image_url as Record<string, unknown>).url === 'string'
    ) {
      return (p.image_url as Record<string, unknown>).url as string;
    }
    if (typeof p.url === 'string') return p.url;
    return null;
  }

  async generateResponse(params: {
    model: UnifiedModel;
    provider: ProviderConfig;
    adapter: ProviderAdapter;
    input: string | unknown[];
    instructions?: string;
    stream?: boolean;
    temperature?: number;
    maxOutputTokens?: number;
    tools?: unknown[];
    toolChoice?: unknown;
    responseFormat?: { type: string; [key: string]: unknown };
    signal?: AbortSignal;
  }): Promise<
    | { isStream: false; data: OpenAIResponseObject }
    | { isStream: true; stream: ReadableStream }
  > {
    const now = Math.floor(Date.now() / 1000);
    const respId = this.generateId('resp_');

    const messages = this.buildMessagesFromInput(params.input, params.instructions);

    if (!params.adapter.chatCompletions) {
      throw new Error(`Provider adapter ${params.adapter.id} does not support chatCompletions.`);
    }

    const chatRequest: OpenAIChatCompletionRequest = {
      model: params.model.id,
      messages,
      stream: params.stream,
    };
    if (params.temperature !== undefined) chatRequest.temperature = params.temperature;
    if (params.maxOutputTokens !== undefined) {
      chatRequest.max_tokens = params.maxOutputTokens;
      chatRequest.max_completion_tokens = params.maxOutputTokens;
    }
    if (params.tools !== undefined) chatRequest.tools = params.tools;
    if (params.toolChoice !== undefined) chatRequest.tool_choice = params.toolChoice;
    if (params.responseFormat !== undefined) {
      chatRequest.response_format = params.responseFormat as OpenAIChatCompletionRequest['response_format'];
    }

    const upstreamResponse = await params.adapter.chatCompletions(
      chatRequest,
      params.provider,
      params.signal
    );

    if (!upstreamResponse.ok) {
      const errText = await upstreamResponse.text().catch(() => 'Upstream completion error');
      throw new Error(`Upstream error (${upstreamResponse.status}): ${errText}`);
    }

    if (params.stream) {
      const msgId = this.generateId('msg_');
      const textDecoder = new TextDecoder();
      const textEncoder = new TextEncoder();

      const upstreamBody = upstreamResponse.body;
      if (!upstreamBody) {
        throw new Error('Upstream response body is null in streaming mode.');
      }

      let accumulatedText = '';
      const reader = (upstreamBody as ReadableStream<Uint8Array>).getReader();

      const transformedStream = new ReadableStream({
        async start(controller) {
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
          controller.enqueue(
            textEncoder.encode(`event: response.created\ndata: ${JSON.stringify(initialEnvelope)}\n\n`)
          );

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
          controller.enqueue(
            textEncoder.encode(
              `event: response.output_item.added\ndata: ${JSON.stringify(outputItemAdded)}\n\n`
            )
          );

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
                  controller.enqueue(
                    textEncoder.encode(
                      `event: response.output_text.delta\ndata: ${JSON.stringify(deltaEnvelope)}\n\n`
                    )
                  );
                }
              } catch {
                // ignore malformed SSE lines
              }
            }
          }

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
          controller.enqueue(
            textEncoder.encode(
              `event: response.completed\ndata: ${JSON.stringify(completedEnvelope)}\n\n`
            )
          );
          controller.enqueue(textEncoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      return { isStream: true, stream: transformedStream };
    }

    const json = (await upstreamResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: OpenAIResponseObject['usage'];
    };
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
      usage: json.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };

    // Intentionally not persisted — response id is request-scoped only.
    return { isStream: false, data: responseObj };
  }
}
