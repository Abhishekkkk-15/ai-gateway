/**
 * AI Gateway Example: Asynchronous Batches API (POST /v1/batches)
 *
 * Demonstrates submitting asynchronous batch jobs (up to 50% discount / high throughput)
 * using the official OpenAI Node.js SDK.
 *
 * Usage:
 *   npx tsx examples/nodejs/batches-demo.ts
 */

import OpenAI, { toFile } from 'openai';

const baseURL = process.env.GATEWAY_BASE_URL || 'http://localhost:3000/v1';
const apiKey = process.env.GATEWAY_API_KEY || 'sk-gw-test-key';

const client = new OpenAI({
  baseURL,
  apiKey,
});

async function main() {
  console.log(`[AI Gateway] Connecting to: ${baseURL}`);
  console.log('--- Asynchronous Batches API Demo ---\n');

  try {
    // 1. Prepare batch JSONL input file
    console.log('1. Preparing and uploading batch request file (.jsonl)...');
    const batchRequests = [
      JSON.stringify({
        custom_id: 'request-task-1',
        method: 'POST',
        url: '/v1/chat/completions',
        body: { model: 'groq/llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'Summarize quantum computing in 10 words.' }] },
      }),
      JSON.stringify({
        custom_id: 'request-task-2',
        method: 'POST',
        url: '/v1/chat/completions',
        body: { model: 'groq/llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'What is Moore\'s Law?' }] },
      }),
    ].join('\n');

    const file = await client.files.create({
      file: await toFile(Buffer.from(batchRequests, 'utf-8'), 'batch_tasks.jsonl', { type: 'application/jsonl' }),
      purpose: 'batch',
    });

    console.log(`[Success] Batch input file uploaded: ${file.id}`);

    // 2. Submit batch job
    console.log('\n2. Submitting batch job (24h completion window)...');
    const batch = await client.batches.create({
      input_file_id: file.id,
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
      metadata: { job_tag: 'research_evaluation' },
    });

    console.log(`[Success] Batch initiated: ${batch.id}`);
    console.log(` • Status: ${batch.status}`);
    console.log(` • Total Requests: ${batch.request_counts.total}`);

    // 3. Retrieve batch status
    console.log(`\n3. Checking batch status for ${batch.id}...`);
    const status = await client.batches.retrieve(batch.id);
    console.log(` • Current Status: ${status.status}`);
    console.log(` • Output File ID: ${status.output_file_id || 'pending...'}`);

    if (status.output_file_id) {
      const output = await client.files.content(status.output_file_id);
      const text = await output.text();
      console.log(`\n4. Batch Output Preview:\n${text}`);
    }

  } catch (error: any) {
    console.error('\n[Error]:', error.message || error);
    if (error.status) console.error(`HTTP Status: ${error.status}`);
  }
}

main();
