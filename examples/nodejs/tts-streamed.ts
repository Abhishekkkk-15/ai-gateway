/**
 * AI Gateway Example: Streamed Text-to-Speech (TTS)
 *
 * Demonstrates real-time audio chunk streaming from /v1/audio/speech.
 * As ElevenLabs streams audio chunks back to the gateway with optimize_streaming_latency,
 * this client receives each binary chunk progressively, calculating Time-to-First-Audio (TTFA).
 *
 * Usage:
 *   npx tsx examples/nodejs/tts-streamed.ts
 *   or: node --experimental-strip-types examples/nodejs/tts-streamed.ts
 */

import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

const baseURL = process.env.GATEWAY_BASE_URL || 'http://localhost:3000/v1';
const apiKey = process.env.GATEWAY_API_KEY || 'sk-gw-test-key';
const model = process.env.GATEWAY_TTS_MODEL || 'eleven_flash_v2_5';
// Default premade voice (Free plan supported): George (JBFqnCBsd6RMkjVDRZzb)
const voice = process.env.GATEWAY_TTS_VOICE || 'JBFqnCBsd6RMkjVDRZzb';

const client = new OpenAI({
  baseURL,
  apiKey,
});

async function main() {
  const textInput =
    'The AI Gateway streams audio chunks with sub-100-millisecond time-to-first-audio directly over chunked HTTP.';
  const outputFile = path.resolve('speech-streamed.mp3');

  console.log(`[AI Gateway] Connecting to: ${baseURL}`);
  console.log(`[AI Gateway] TTS Model: ${model} | Voice ID: ${voice}`);
  console.log(`[Input Text]: "${textInput}"`);
  console.log('--- Initiating Chunked Audio Stream ---\n');

  const startTime = Date.now();
  let firstChunkTime: number | null = null;
  let totalBytes = 0;
  let chunkCount = 0;

  try {
    const response = await client.audio.speech.create({
      model,
      voice,
      input: textInput,
    });

    if (!response.body) {
      throw new Error('Response body stream is not available');
    }

    const fileStream = fs.createWriteStream(outputFile);
    const nodeReadable = Readable.fromWeb(response.body as any);

    for await (const chunk of nodeReadable) {
      if (firstChunkTime === null) {
        firstChunkTime = Date.now();
      }

      const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += chunkBuffer.length;
      chunkCount++;

      fileStream.write(chunkBuffer);
      process.stdout.write(`\rReceived chunk #${chunkCount} (${totalBytes} bytes)...`);
    }

    fileStream.end();

    const totalDuration = Date.now() - startTime;
    const ttfa = firstChunkTime ? firstChunkTime - startTime : null;
    const sizeKb = (totalBytes / 1024).toFixed(2);

    console.log('\n\n--- Streaming Audio Telemetry ---');
    console.log(`Time-To-First-Audio (TTFA): ${ttfa !== null ? `${ttfa}ms` : 'N/A'}`);
    console.log(`Total Latency: ${totalDuration}ms`);
    console.log(`Total Received: ${chunkCount} chunks (${sizeKb} KB)`);
    console.log(`Audio saved to: ${outputFile}`);
  } catch (error: any) {
    console.error('\n[Error]:', error.message || error);
    if (error.status) console.error(`HTTP Status: ${error.status}`);
  }
}

main();
