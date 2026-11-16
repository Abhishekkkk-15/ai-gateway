/**
 * AI Gateway Example: Next-Gen Responses API (POST /v1/responses)
 *
 * Demonstrates the flagship Responses API (`client.responses.create`) from OpenAI's
 * latest SDK, including direct `output_text` accessor and stateful continuation.
 *
 * Usage:
 *   npx tsx examples/nodejs/responses-demo.ts
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
  console.log('--- Next-Gen Responses API Demo ---\n');

  try {
    // 1. Initial turn using convenient string input
    console.log('1. Prompting via Responses API...');
    const response1 = await (client as any).responses.create({
      model,
      input: 'Explain the benefit of an in-memory routing cache in 2 sentences.',
      instructions: 'You are an ultra-concise systems architect.',
    });

    console.log(`[Success] Response ID: ${response1.id}`);
    console.log(` • Output Text: ${response1.output_text}`);
    console.log(` • Total Tokens: ${response1.usage?.total_tokens}`);

    // 2. Chained multi-turn continuation via previous_response_id
    console.log('\n2. Chaining continuation turn via previous_response_id...');
    const response2 = await (client as any).responses.create({
      model,
      input: 'Now give me the single biggest trade-off.',
      previous_response_id: response1.id,
    });

    console.log(`[Success] Continuation Response ID: ${response2.id}`);
    console.log(` • Output Text: ${response2.output_text}`);

  } catch (error: any) {
    console.error('\n[Error]:', error.message || error);
    if (error.status) console.error(`HTTP Status: ${error.status}`);
  }
}

main();
