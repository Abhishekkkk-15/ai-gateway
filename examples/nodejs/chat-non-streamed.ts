/**
 * AI Gateway Example: Non-Streamed Chat Completion
 *
 * Demonstrates standard OpenAI SDK drop-in integration with the AI Gateway.
 * The gateway routes this request to the optimal upstream provider in < 1ms.
 *
 * Usage:
 *   npx tsx examples/nodejs/chat-non-streamed.ts
 *   or: node --experimental-strip-types examples/nodejs/chat-non-streamed.ts
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
  console.log('--- Sending Non-Streamed Chat Request ---');

  const startTime = Date.now();

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a concise, helpful assistant explaining distributed systems.',
        },
        {
          role: 'user',
          content: 'Explain why in-memory routing caches deliver sub-millisecond latencies in 2 sentences.',
        },
      ],
      temperature: 0.7,
      stream: false,
    });

    const duration = Date.now() - startTime;
    const choice = response.choices[0];

    console.log('\n[Response Content]:');
    console.log(choice.message.content);

    console.log('\n--- Telemetry Metrics ---');
    console.log(`Total Latency: ${duration}ms`);
    if (response.usage) {
      console.log(`Prompt Tokens: ${response.usage.prompt_tokens}`);
      console.log(`Completion Tokens: ${response.usage.completion_tokens}`);
      console.log(`Total Tokens: ${response.usage.total_tokens}`);
    }
  } catch (error: any) {
    console.error('[Error]:', error.message || error);
    if (error.status) console.error(`HTTP Status: ${error.status}`);
  }
}

main();
