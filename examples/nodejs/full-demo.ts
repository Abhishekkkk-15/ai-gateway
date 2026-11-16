/**
 * AI Gateway Example: Full Multi-Modal End-to-End Pipeline
 *
 * Demonstrates a complete flow through the AI Gateway:
 *   1. List available routable models (/v1/models)
 *   2. Stream a conversational Chat Completion (/v1/chat/completions with stream: true)
 *   3. Synthesize the assistant's response to an MP3 audio stream (/v1/audio/speech)
 *
 * Usage:
 *   npx tsx examples/nodejs/full-demo.ts
 *   or: node --experimental-strip-types examples/nodejs/full-demo.ts
 */

import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

const baseURL = process.env.GATEWAY_BASE_URL || 'http://localhost:3000/v1';
const apiKey = process.env.GATEWAY_API_KEY || 'sk-gw-test-key';
const chatModel = process.env.GATEWAY_MODEL || 'groq/llama-3.3-70b-versatile';
const ttsModel = process.env.GATEWAY_TTS_MODEL || 'eleven_flash_v2_5';
const voiceId = process.env.GATEWAY_TTS_VOICE || 'JBFqnCBsd6RMkjVDRZzb'; // George (Premade Free)

const client = new OpenAI({
  baseURL,
  apiKey,
});

async function main() {
  console.log('========================================================');
  console.log('   AI GATEWAY MULTI-MODAL PIPELINE DEMONSTRATION');
  console.log('========================================================');
  console.log(`Gateway Base URL: ${baseURL}\n`);

  // STEP 1: Query Models Catalog
  console.log('>>> Step 1: Querying Active Catalog (/v1/models)...');
  try {
    const modelsList = await client.models.list();
    console.log(`Found ${modelsList.data.length} registered routable models:`);
    for (const m of modelsList.data.slice(0, 5)) {
      console.log(`  • ${m.id} (owned by: ${m.owned_by})`);
    }
    if (modelsList.data.length > 5) {
      console.log(`  ... and ${modelsList.data.length - 5} more.`);
    }
  } catch (err: any) {
    console.warn('Could not query /v1/models (check if key is authorized):', err.message);
  }

  // STEP 2: Stream Chat Completion
  console.log('\n>>> Step 2: Streaming Chat Completion (/v1/chat/completions)...');
  const userPrompt = 'Summarize what makes an edge AI gateway ultra-fast in one punchy sentence.';
  console.log(`User: "${userPrompt}"`);

  let assistantText = '';
  const chatStartTime = Date.now();
  let firstTokenTime: number | null = null;

  try {
    const stream = await client.chat.completions.create({
      model: chatModel,
      messages: [{ role: 'user', content: userPrompt }],
      stream: true,
    });

    process.stdout.write('Assistant: ');

    for await (const chunk of stream) {
      if (firstTokenTime === null) firstTokenTime = Date.now();
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        process.stdout.write(content);
        assistantText += content;
      }
    }

    const chatTotalMs = Date.now() - chatStartTime;
    const ttft = firstTokenTime ? firstTokenTime - chatStartTime : null;
    console.log(`\n[Chat Done: ${chatTotalMs}ms | TTFT: ${ttft || 0}ms]`);
  } catch (err: any) {
    console.error('Chat failed:', err.message);
    assistantText = 'An in-memory routing cache delivers sub-millisecond latencies by avoiding database round trips.';
  }

  // STEP 3: Stream Text-to-Speech
  console.log('\n>>> Step 3: Streaming Speech Synthesis (/v1/audio/speech)...');
  console.log(`Voice: ${voiceId} | Model: ${ttsModel}`);
  const outputFile = path.resolve('demo-pipeline-output.mp3');

  try {
    const ttsStartTime = Date.now();
    const speechResponse = await client.audio.speech.create({
      model: ttsModel,
      voice: voiceId,
      input: assistantText,
    });

    if (speechResponse.body) {
      const fileStream = fs.createWriteStream(outputFile);
      const nodeStream = Readable.fromWeb(speechResponse.body as any);
      let bytes = 0;

      for await (const chunk of nodeStream) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buf.length;
        fileStream.write(buf);
      }
      fileStream.end();

      const ttsTotalMs = Date.now() - ttsStartTime;
      console.log(`[TTS Done: ${ttsTotalMs}ms | Audio Size: ${(bytes / 1024).toFixed(1)} KB]`);
      console.log(`Generated Audio saved to: ${outputFile}`);
    }
  } catch (err: any) {
    console.error('TTS failed:', err.message);
  }

  console.log('\n========================================================');
  console.log('   PIPELINE COMPLETE - 100% OPENAI SDK COMPATIBLE');
  console.log('========================================================\n');
}

main();
