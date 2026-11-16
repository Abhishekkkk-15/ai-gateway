/**
 * AI Gateway Example: Vector Embeddings (POST /v1/embeddings)
 *
 * Demonstrates generating vector embeddings using the official OpenAI Node.js SDK.
 * Compatible with single string, array of strings, Matryoshka dimensions truncation,
 * and base64/float encoding formats.
 *
 * Usage:
 *   npx tsx examples/nodejs/embeddings-demo.ts
 *   or: node --experimental-strip-types examples/nodejs/embeddings-demo.ts
 */

import OpenAI from 'openai';

const baseURL = process.env.GATEWAY_BASE_URL || 'http://localhost:3000/v1';
const apiKey = process.env.GATEWAY_API_KEY || 'sk-gw-test-key';
// Model can be 'text-embedding-3-small', 'text-embedding-3-large', 'nvidia/nv-embedqa-e5-v5', etc.
const model = process.env.GATEWAY_EMBEDDING_MODEL || 'text-embedding-3-small';

const client = new OpenAI({
  baseURL,
  apiKey,
});

async function main() {
  console.log(`[AI Gateway] Connecting to: ${baseURL}`);
  console.log(`[AI Gateway] Embedding Model: ${model}`);
  console.log('--- Generating Vector Embeddings ---\n');

  const startTime = Date.now();

  try {
    const inputDocuments = [
      'An in-memory routing cache delivers sub-millisecond AI gateway routing.',
      'Vector embeddings map semantic meanings into high-dimensional geometric spaces.',
    ];

    const response = await client.embeddings.create({
      model,
      input: inputDocuments,
    });

    const duration = Date.now() - startTime;

    console.log(`[Success] Generated ${response.data.length} embeddings in ${duration}ms!`);
    for (const item of response.data) {
      const vector = item.embedding as number[];
      console.log(` • Item #${item.index}: vector length = ${vector.length}, sample values = [${vector.slice(0, 4).map(v => v.toFixed(4)).join(', ')}...]`);
    }

    if (response.usage) {
      console.log(`\nTokens Consumed: ${response.usage.prompt_tokens} prompt tokens`);
    }
  } catch (error: any) {
    console.error('\n[Error]:', error.message || error);
    if (error.status) console.error(`HTTP Status: ${error.status}`);
  }
}

main();
