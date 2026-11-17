/**
 * AI Gateway Example: Vector Stores API (/v1/vector_stores)
 *
 * Demonstrates managing vector stores, attaching knowledge files, and managing
 * file batches using the official OpenAI Node.js SDK.
 *
 * Usage:
 *   npx tsx examples/nodejs/vector-stores-demo.ts
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
  console.log('--- Vector Stores API Demo ---\n');

  try {
    // 1. Upload sample knowledge document
    console.log('1. Uploading documentation file...');
    const docContent = `
      Antigravity AI Gateway Architecture:
      - In-Memory Zero-DB routing resolution under 1ms
      - Modular Provider Adapters (Groq, Nvidia, ElevenLabs, OpenAI)
      - Integrated Streaming Telemetry Queue
    `;
    const file = await client.files.create({
      file: await toFile(Buffer.from(docContent, 'utf-8'), 'gateway_arch.txt', { type: 'text/plain' }),
      purpose: 'assistants',
    });
    console.log(`[Success] Uploaded document file: ${file.id}`);

    // 2. Create vector store with file attached
    console.log('\n2. Creating vector store and indexing file...');
    const vectorStore = await client.vectorStores.create({
      name: 'Gateway Engineering Knowledge Base',
      file_ids: [file.id],
      metadata: { department: 'platform_infra' },
    });

    console.log(`[Success] Vector store created: ${vectorStore.id}`);
    console.log(` • Name: ${vectorStore.name}`);
    console.log(` • Files Indexed: ${vectorStore.file_counts.total}`);

    // 3. List vector stores
    console.log('\n3. Listing available vector stores...');
    const stores = await client.vectorStores.list();
    console.log(`Total vector stores: ${stores.data.length}`);
    for (const s of stores.data) {
      console.log(` • [${s.id}] ${s.name} (${s.file_counts.total} files, status: ${s.status})`);
    }

    // 4. Clean up
    console.log(`\n4. Cleaning up vector store: ${vectorStore.id}...`);
    const delStore = await client.vectorStores.delete(vectorStore.id);
    console.log(`[Success] Deleted vector store: ${delStore.id} (deleted: ${delStore.deleted})`);

    await client.files.delete(file.id);
    console.log(`[Success] Deleted backing file: ${file.id}`);

  } catch (error: any) {
    console.error('\n[Error]:', error.message || error);
    if (error.status) console.error(`HTTP Status: ${error.status}`);
  }
}

main();
