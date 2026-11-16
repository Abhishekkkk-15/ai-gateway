import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';

describe('Assistants v2 & Stateful Agent Engine (/v1/assistants, /v1/threads, /v1/runs)', () => {
  let app: FastifyInstance;
  const validKey = 'sk-gw-test-valid-key-assistants';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();

    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-asst-1',
      name: 'Test Assistants Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });

    // Seed mock model for assistant runs
    app.routingCache.setModelForTesting('mock/gpt-4o', {
      model: {
        id: 'gpt-4o',
        providerId: 'mock-provider',
        slug: 'mock/gpt-4o',
        displayName: 'GPT-4o Mock',
        capabilities: ['chat'],
        isEnabled: true,
      },
      provider: {
        id: 'mock-provider',
        name: 'Mock Provider',
        adapterType: 'openai-compatible',
        baseUrl: 'https://api.mock.com/v1',
        apiKey: 'mock-key',
        isEnabled: true,
      },
      adapter: app.providerRegistry.getGenericAdapter(),
    });

    app.routingCache.setAliasForTesting('gpt-4o', 'mock/gpt-4o');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/assistants',
      payload: { model: 'gpt-4o', name: 'Unauthorized Tutor' },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error?.code).toBe('invalid_api_key');
  });

  it('creates, lists, retrieves, and updates an assistant', async () => {
    // 1. Create assistant
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/assistants',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'gpt-4o',
        name: 'Math Professor',
        instructions: 'You solve mathematical proofs clearly.',
        tools: [{ type: 'code_interpreter' }],
        metadata: { subject: 'calculus' },
      },
    });

    expect(createRes.statusCode).toBe(200);
    const asst = JSON.parse(createRes.body);
    expect(asst.id).toMatch(/^asst_[a-zA-Z0-9_-]+$/);
    expect(asst.object).toBe('assistant');
    expect(asst.name).toBe('Math Professor');
    expect(asst.metadata?.subject).toBe('calculus');

    const assistantId = asst.id;

    // 2. List assistants
    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/assistants',
      headers: { Authorization: `Bearer ${validKey}` },
    });

    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.body);
    expect(list.object).toBe('list');
    expect(list.data.some((a: any) => a.id === assistantId)).toBe(true);

    // 3. Retrieve assistant
    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/assistants/${assistantId}`,
      headers: { Authorization: `Bearer ${validKey}` },
    });

    expect(getRes.statusCode).toBe(200);
    const retrieved = JSON.parse(getRes.body);
    expect(retrieved.id).toBe(assistantId);
    expect(retrieved.name).toBe('Math Professor');

    // 4. Update assistant
    const updateRes = await app.inject({
      method: 'POST',
      url: `/v1/assistants/${assistantId}`,
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        name: 'Senior Math Professor',
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = JSON.parse(updateRes.body);
    expect(updated.name).toBe('Senior Math Professor');
  });

  it('creates thread, posts message, triggers run and retrieves assistant response message', async () => {
    const originalFetch = globalThis.fetch;
    const mockChatCompletion = {
      id: 'chatcmpl-asst-run-99',
      object: 'chat.completion',
      created: 1710000000,
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'The solution is x = 4.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 14, completion_tokens: 8, total_tokens: 22 },
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockChatCompletion), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // 1. Create thread
    const threadRes = await app.inject({
      method: 'POST',
      url: '/v1/threads',
      headers: { Authorization: `Bearer ${validKey}` },
      payload: { metadata: { student: 'Alice' } },
    });

    expect(threadRes.statusCode).toBe(200);
    const thread = JSON.parse(threadRes.body);
    expect(thread.id).toMatch(/^thread_[a-zA-Z0-9_-]+$/);
    const threadId = thread.id;

    // 2. Post user message
    const msgRes = await app.inject({
      method: 'POST',
      url: `/v1/threads/${threadId}/messages`,
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        role: 'user',
        content: 'Solve 2x + 6 = 14',
      },
    });

    expect(msgRes.statusCode).toBe(200);
    const msg = JSON.parse(msgRes.body);
    expect(msg.id).toMatch(/^msg_[a-zA-Z0-9_-]+$/);
    expect(msg.role).toBe('user');
    expect(msg.content[0].text.value).toBe('Solve 2x + 6 = 14');

    // 3. Trigger run
    const runRes = await app.inject({
      method: 'POST',
      url: `/v1/threads/${threadId}/runs`,
      headers: { Authorization: `Bearer ${validKey}` },
      payload: {
        model: 'gpt-4o',
        instructions: 'Solve algebraic equations with final answer.',
      },
    });

    expect(runRes.statusCode).toBe(200);
    const run = JSON.parse(runRes.body);
    expect(run.id).toMatch(/^run_[a-zA-Z0-9_-]+$/);
    expect(run.object).toBe('thread.run');
    expect(run.status).toBe('completed');

    // 4. List messages in thread to verify assistant response was added
    const listMsgRes = await app.inject({
      method: 'GET',
      url: `/v1/threads/${threadId}/messages`,
      headers: { Authorization: `Bearer ${validKey}` },
    });

    expect(listMsgRes.statusCode).toBe(200);
    const msgList = JSON.parse(listMsgRes.body);
    expect(msgList.data.length).toBeGreaterThanOrEqual(2);
    const assistantMsg = msgList.data.find((m: any) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg.content[0].text.value).toBe('The solution is x = 4.');

    globalThis.fetch = originalFetch;
  });
});
