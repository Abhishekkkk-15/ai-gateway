/**
 * AI Gateway Example: Non-Streamed Text-to-Speech (TTS)
 *
 * Demonstrates generating full audio via OpenAI's /v1/audio/speech endpoint.
 * The AI Gateway routes the request to ElevenLabs (or configured provider)
 * and returns the binary audio buffer saved directly to disk.
 *
 * Note on Voices:
 *   - ElevenLabs Default Premade (Free tier supported): 'JBFqnCBsd6RMkjVDRZzb' (George), '21m00Tcm4TlvDq8ikWAM' (Rachel)
 *   - OpenAI standard voices: 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
 *
 * Usage:
 *   npx tsx examples/nodejs/tts-non-streamed.ts
 *   or: node --experimental-strip-types examples/nodejs/tts-non-streamed.ts
 */

import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';

const baseURL = process.env.GATEWAY_BASE_URL || 'http://localhost:3000/v1';
const apiKey = process.env.GATEWAY_API_KEY || 'sk-gw-test-key';
// Model can be 'eleven_flash_v2_5', 'eleven_multilingual_v2', or 'tts-1'
const model = process.env.GATEWAY_TTS_MODEL || 'eleven_flash_v2_5';
// George (JBFqnCBsd6RMkjVDRZzb) or Rachel (21m00Tcm4TlvDq8ikWAM) are default premade free voices
const voice = process.env.GATEWAY_TTS_VOICE || 'JBFqnCBsd6RMkjVDRZzb';

const client = new OpenAI({
  baseURL,
  apiKey,
});

async function main() {
  const textInput =
    'Hello! This audio was generated through the unified AI Gateway using the OpenAI SDK audio speech API.';
  const outputFile = path.resolve('speech-non-streamed.mp3');

  console.log(`[AI Gateway] Connecting to: ${baseURL}`);
  console.log(`[AI Gateway] TTS Model: ${model} | Voice ID: ${voice}`);
  console.log(`[Input Text]: "${textInput}"`);
  console.log('--- Requesting Binary Audio Speech Synthesis ---');

  const startTime = Date.now();

  try {
    const response = await client.audio.speech.create({
      model,
      voice,
      input: textInput,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(outputFile, buffer);

    const duration = Date.now() - startTime;
    const sizeKb = (buffer.length / 1024).toFixed(2);

    console.log('\n[Success] Audio synthesized successfully!');
    console.log(`Output File: ${outputFile}`);
    console.log(`Audio Size: ${sizeKb} KB`);
    console.log(`Total Latency: ${duration}ms`);
  } catch (error: any) {
    console.error('\n[Error]:', error.message || error);
    if (error.status) console.error(`HTTP Status: ${error.status}`);
  }
}

main();
