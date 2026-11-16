/**
 * AI Gateway Example: Images Generation (POST /v1/images/generations)
 *
 * Demonstrates generating images using the official OpenAI Node.js SDK.
 * Compatible with standard prompt generation, size parameters, quality, style,
 * and both URL and base64 formats.
 *
 * Usage:
 *   npx tsx examples/nodejs/images-demo.ts
 */

import OpenAI from 'openai';

const baseURL = process.env.GATEWAY_BASE_URL || 'http://localhost:3000/v1';
const apiKey = process.env.GATEWAY_API_KEY || 'sk-gw-test-key';
const model = process.env.GATEWAY_IMAGE_MODEL || 'dall-e-3';

const client = new OpenAI({
  baseURL,
  apiKey,
});

async function main() {
  console.log(`[AI Gateway] Connecting to: ${baseURL}`);
  console.log(`[AI Gateway] Image Model: ${model}`);
  console.log('--- Generating Image ---\n');

  const startTime = Date.now();

  try {
    const prompt = 'A futuristic neon cybernetic observatory under a galaxy of stars, digital art';
    const response = await client.images.generate({
      model,
      prompt,
      size: '1024x1024',
      quality: 'hd',
      n: 1,
    });

    const duration = Date.now() - startTime;

    console.log(`[Success] Generated ${response.data?.length || 0} image(s) in ${duration}ms!`);
    if (response.data && response.data.length > 0) {
      for (const item of response.data) {
        if (item.url) {
          console.log(` • Image URL: ${item.url}`);
        } else if (item.b64_json) {
          console.log(` • Base64 payload length: ${item.b64_json.length} characters`);
        }
        if (item.revised_prompt) {
          console.log(` • Revised Prompt: ${item.revised_prompt}`);
        }
      }
    }
  } catch (error: any) {
    console.error('\n[Error]:', error.message || error);
    if (error.status) console.error(`HTTP Status: ${error.status}`);
  }
}

main();
