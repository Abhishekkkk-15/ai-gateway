/**
 * AI Gateway Example: Files & Resumable Uploads (POST /v1/files, GET, DELETE)
 *
 * Demonstrates managing persistent files and datasets using the official OpenAI Node.js SDK.
 * Supports file uploads, list inspection, content streaming, and deletions.
 *
 * Usage:
 *   npx tsx examples/nodejs/files-demo.ts
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
  console.log('--- Persistent Files API Demo ---\n');

  try {
    // 1. Upload a dataset file
    console.log('1. Uploading fine-tuning dataset...');
    const dataset = [
      JSON.stringify({ messages: [{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: 'What is AI Gateway?' }, { role: 'assistant', content: 'AI Gateway is a lightning-fast OpenAI-compatible proxy.' }] }),
      JSON.stringify({ messages: [{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: 'Explain Zero-DB routing.' }, { role: 'assistant', content: 'Zero-DB routing resolves providers and models directly in RAM in under 1 millisecond.' }] }),
    ].join('\n');

    const fileBuffer = Buffer.from(dataset, 'utf-8');
    const uploadedFile = await client.files.create({
      file: await toFile(fileBuffer, 'sample_dataset.jsonl', { type: 'application/jsonl' }),
      purpose: 'fine-tune',
    });

    console.log(`[Success] Uploaded file: ${uploadedFile.id} (${uploadedFile.filename}, ${uploadedFile.bytes} bytes)`);

    // 2. List all files
    console.log('\n2. Listing available files...');
    const fileList = await client.files.list();
    console.log(`Total files in gateway storage: ${fileList.data.length}`);
    for (const f of fileList.data.slice(0, 5)) {
      console.log(` • [${f.id}] ${f.filename} (${f.bytes} bytes, purpose: ${f.purpose}, status: ${f.status})`);
    }

    // 3. Retrieve specific file content
    console.log(`\n3. Downloading content for: ${uploadedFile.id}...`);
    const contentResponse = await client.files.content(uploadedFile.id);
    const downloadedText = await contentResponse.text();
    console.log(`Downloaded content preview:\n${downloadedText.split('\n').map(l => '   ' + l).join('\n')}`);

    // 4. Delete uploaded file
    console.log(`\n4. Cleaning up file: ${uploadedFile.id}...`);
    const deleteResult = await client.files.delete(uploadedFile.id);
    console.log(`[Success] File deleted: ${deleteResult.id} (deleted: ${deleteResult.deleted})`);

  } catch (error: any) {
    console.error('\n[Error]:', error.message || error);
    if (error.status) console.error(`HTTP Status: ${error.status}`);
  }
}

main();
