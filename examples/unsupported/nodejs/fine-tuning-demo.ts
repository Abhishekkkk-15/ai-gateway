/**
 * AI Gateway Example: Fine-Tuning API (/v1/fine_tuning/jobs)
 *
 * Demonstrates creating and managing model customization fine-tuning jobs
 * using the official OpenAI Node.js SDK.
 *
 * Usage:
 *   npx tsx examples/nodejs/fine-tuning-demo.ts
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
  console.log('--- Fine-Tuning API Demo ---\n');

  try {
    // 1. Upload training dataset
    console.log('1. Uploading training dataset for fine-tuning...');
    const trainingLines = [
      JSON.stringify({ messages: [{ role: 'system', content: 'You speak in iambic pentameter.' }, { role: 'user', content: 'Hello' }, { role: 'assistant', content: 'A fair good morrow unto thee, fair friend.' }] }),
      JSON.stringify({ messages: [{ role: 'system', content: 'You speak in iambic pentameter.' }, { role: 'user', content: 'How are you?' }, { role: 'assistant', content: 'I stand in health and joyful in the sun.' }] }),
    ].join('\n');

    const file = await client.files.create({
      file: await toFile(Buffer.from(trainingLines, 'utf-8'), 'pentameter.jsonl', { type: 'application/jsonl' }),
      purpose: 'fine-tune',
    });
    console.log(`[Success] Training file uploaded: ${file.id}`);

    // 2. Create fine-tuning job
    console.log('\n2. Creating fine-tuning job...');
    const job = await client.fineTuning.jobs.create({
      training_file: file.id,
      model: 'gpt-4o-mini-2024-07-18',
      hyperparameters: { n_epochs: 3 },
    });
    console.log(`[Success] Fine-Tuning Job Created: ${job.id}`);
    console.log(` • Status: ${job.status}`);
    console.log(` • Base Model: ${job.model}`);

    // 3. List fine-tuning jobs
    console.log('\n3. Listing all fine-tuning jobs...');
    const jobList = await client.fineTuning.jobs.list();
    console.log(`Total jobs: ${jobList.data.length}`);
    for (const j of jobList.data.slice(0, 5)) {
      console.log(` • [${j.id}] ${j.model} -> status: ${j.status}`);
    }

    // 4. Cancel job
    console.log(`\n4. Cancelling fine-tuning job: ${job.id}...`);
    const cancelled = await client.fineTuning.jobs.cancel(job.id);
    console.log(`[Success] Job cancelled: ${cancelled.id} (status: ${cancelled.status})`);

  } catch (error: any) {
    console.error('\n[Error]:', error.message || error);
    if (error.status) console.error(`HTTP Status: ${error.status}`);
  }
}

main();
