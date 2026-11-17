/**
 * AI Gateway Example: Assistants v2 & Stateful Agent Engine (/v1/assistants, /v1/threads, /v1/runs)
 *
 * Demonstrates creating stateful AI assistants, managing threads and messages,
 * and triggering runs using the official OpenAI Node.js SDK.
 *
 * Usage:
 *   npx tsx examples/nodejs/assistants-v2-demo.ts
 */

import OpenAI from 'openai';

const baseURL = process.env.GATEWAY_BASE_URL || 'http://localhost:3000/v1';
const apiKey = process.env.GATEWAY_API_KEY || 'sk-gw-test-key';
const model = process.env.GATEWAY_CHAT_MODEL || 'groq/llama-3.3-70b-versatile';

const client = new OpenAI({
  baseURL,
  apiKey,
});

async function main() {
  console.log(`[AI Gateway] Connecting to: ${baseURL}`);
  console.log(`[AI Gateway] Model: ${model}`);
  console.log('--- Assistants v2 Agent Demo ---\n');

  try {
    // 1. Create an Assistant
    console.log('1. Creating autonomous assistant...');
    const assistant = await client.beta.assistants.create({
      model,
      name: 'DevOps & Gateway Specialist',
      instructions: 'You are an expert engineer. Always provide precise code snippets and architectures.',
      tools: [{ type: 'code_interpreter' }],
    });
    console.log(`[Success] Assistant Created: ${assistant.id} (${assistant.name})`);

    // 2. Create a Thread
    console.log('\n2. Creating conversation thread...');
    const thread = await client.beta.threads.create({
      metadata: { session_type: 'devops_consultation' },
    });
    console.log(`[Success] Thread Created: ${thread.id}`);

    // 3. Post a message to the thread
    console.log('\n3. Posting user message to thread...');
    const userMessage = await client.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: 'How should I configure CORS for a Fastify AI Gateway handling SSE streaming?',
    });
    console.log(`[Success] User Message Added: ${userMessage.id}`);

    // 4. Trigger Run
    console.log('\n4. Executing assistant run...');
    const run = await client.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
      instructions: 'Give a 2-step setup answer with TypeScript code.',
    });
    console.log(`[Success] Run Completed: ${run.id} (status: ${run.status})`);

    // 5. Inspect Thread Message History
    console.log('\n5. Retrieving updated thread messages...');
    const messages = await client.beta.threads.messages.list(thread.id);
    console.log(`Total messages in thread: ${messages.data.length}`);
    for (const msg of messages.data) {
      const textVal = (msg.content[0] as any)?.text?.value || '';
      console.log(` • [${msg.role.toUpperCase()}]: ${textVal.slice(0, 100)}...`);
    }

    // 6. Cleanup
    console.log(`\n6. Cleaning up assistant: ${assistant.id}...`);
    await client.beta.assistants.delete(assistant.id);
    await client.beta.threads.delete(thread.id);
    console.log('[Success] Assistant and Thread cleaned up.');

  } catch (error: any) {
    console.error('\n[Error]:', error.message || error);
    if (error.status) console.error(`HTTP Status: ${error.status}`);
  }
}

main();
