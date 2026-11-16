/**
 * AI Gateway Example: Streamed Chat Completion (SSE)
 *
 * Demonstrates real-time Server-Sent Events (SSE) token streaming using the OpenAI SDK.
 * Tracks Time-to-First-Token (TTFT) and total streaming throughput.
 *
 * Usage:
 *   npx tsx examples/nodejs/chat-streamed.ts
 *   or: node --experimental-strip-types examples/nodejs/chat-streamed.ts
 */

import OpenAI from 'openai';

const baseURL = process.env.GATEWAY_BASE_URL || 'http://localhost:3000/v1';
const apiKey = process.env.GATEWAY_API_KEY || 'sk-gw-test-key';
const model = process.env.GATEWAY_MODEL || 'groq/llama-3.3-70b-versatile';

const client = new OpenAI({
  baseURL,
  apiKey,
});

async function main() {
  console.log(`[AI Gateway] Connecting to: ${baseURL}`);
  console.log(`[AI Gateway] Target Model: ${model}`);
  console.log('--- Initiating SSE Streaming Request ---\n');

  const startTime = Date.now();
  let firstTokenTime: number | null = null;
  let tokenCount = 0;

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert engineer explaining real-time streaming architectures.',
        },
        {
          role: 'user',
          content: 'Write a concise 3-bullet comparison of Server-Sent Events (SSE) vs WebSockets for LLMs.',
        },
      ],
      stream: true,
    });

    process.stdout.write('[Stream Output]:\n');

    for await (const chunk of stream) {
      if (firstTokenTime === null) {
        firstTokenTime = Date.now();
      }

      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        process.stdout.write(delta);
        tokenCount++;
      }
    }

    const totalDuration = Date.now() - startTime;
    const ttft = firstTokenTime ? firstTokenTime - startTime : null;

    console.log('\n\n--- Streaming Performance Telemetry ---');
    console.log(`Time-To-First-Token (TTFT): ${ttft !== null ? `${ttft}ms` : 'N/A'}`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Streamed Chunks: ${tokenCount}`);
    if (ttft !== null && totalDuration > ttft) {
      const tokensPerSec = ((tokenCount / (totalDuration - ttft)) * 1000).toFixed(1);
      console.log(`Throughput: ~${tokensPerSec} chunks/sec`);
    }
  } catch (error: any) {
    console.error('\n[Error]:', error.message || error);
    if (error.status) console.error(`HTTP Status: ${error.status}`);
  }
}

main();
