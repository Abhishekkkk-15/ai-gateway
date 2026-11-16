/**
 * AI Gateway Example: Speech-to-Text (STT) Audio Transcription
 *
 * Demonstrates transcribing audio via OpenAI's /v1/audio/transcriptions endpoint.
 * The AI Gateway routes the multipart form-data to Whisper (Groq/Nvidia) or Scribe (ElevenLabs).
 *
 * Usage:
 *   npx tsx examples/nodejs/stt-transcription.ts [path/to/audio.mp3]
 *   or: node --experimental-strip-types examples/nodejs/stt-transcription.ts
 */

import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';

const baseURL = process.env.GATEWAY_BASE_URL || 'http://localhost:3000/v1';
const apiKey = process.env.GATEWAY_API_KEY || 'sk-gw-test-key';
// Model can be 'whisper-large-v3-turbo', 'scribe_v1', or custom alias
const model = process.env.GATEWAY_STT_MODEL || 'whisper-large-v3-turbo';

const client = new OpenAI({
  baseURL,
  apiKey,
});

/**
 * Creates a minimal valid 1-second 8kHz mono WAV file in memory if no file is provided.
 */
function createDummyWavBuffer(): Buffer {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const durationSeconds = 1;
  const dataSize = sampleRate * durationSeconds * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF chunk descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // audioformat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // byte rate
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // block align
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

async function main() {
  const cliArg = process.argv[2];
  let targetAudioFile = cliArg;

  // If no file specified, check for speech-streamed.mp3 or create temporary wav
  if (!targetAudioFile || !fs.existsSync(targetAudioFile)) {
    if (fs.existsSync('speech-streamed.mp3')) {
      targetAudioFile = 'speech-streamed.mp3';
    } else if (fs.existsSync('speech-non-streamed.mp3')) {
      targetAudioFile = 'speech-non-streamed.mp3';
    } else {
      targetAudioFile = path.resolve('sample-test-audio.wav');
      fs.writeFileSync(targetAudioFile, createDummyWavBuffer());
      console.log(`[Notice] Created sample test audio file at: ${targetAudioFile}`);
    }
  }

  console.log(`[AI Gateway] Connecting to: ${baseURL}`);
  console.log(`[AI Gateway] STT Model: ${model}`);
  console.log(`[Audio File]: ${targetAudioFile}`);
  console.log('--- Sending Audio Transcription Request ---');

  const startTime = Date.now();

  try {
    const fileStream = fs.createReadStream(targetAudioFile);

    const response = await client.audio.transcriptions.create({
      file: fileStream,
      model,
    });

    const duration = Date.now() - startTime;

    console.log('\n[Transcription Result]:');
    console.log(response.text || '(No text transcribed)');
    console.log('\n--- Telemetry ---');
    console.log(`Total Latency: ${duration}ms`);
  } catch (error: any) {
    console.error('\n[Error]:', error.message || error);
    if (error.status) console.error(`HTTP Status: ${error.status}`);
  }
}

main();
