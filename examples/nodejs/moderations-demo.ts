/**
 * AI Gateway Example: Content Moderations (POST /v1/moderations)
 *
 * Demonstrates evaluating content against safety categories using the official OpenAI Node.js SDK.
 * Returns classification flags, categories (hate, harassment, self-harm, sexual, violence),
 * and fine-grained confidence category scores.
 *
 * Usage:
 *   npx tsx examples/nodejs/moderations-demo.ts
 */

import OpenAI from 'openai';

const baseURL = process.env.GATEWAY_BASE_URL || 'http://localhost:3000/v1';
const apiKey = process.env.GATEWAY_API_KEY || 'sk-gw-test-key';
const model = process.env.GATEWAY_MODERATION_MODEL || 'omni-moderation-latest';

const client = new OpenAI({
  baseURL,
  apiKey,
});

async function main() {
  console.log(`[AI Gateway] Connecting to: ${baseURL}`);
  console.log(`[AI Gateway] Moderation Model: ${model}`);
  console.log('--- Inspecting Content Safety ---\n');

  const startTime = Date.now();

  try {
    const input = [
      'Welcome to the AI Gateway! Fast, reliable, and compliant AI proxy.',
      'I want to hurt people and cause massive chaos everywhere.',
    ];

    const response = await client.moderations.create({
      model,
      input,
    });

    const duration = Date.now() - startTime;

    console.log(`[Success] Evaluated ${response.results.length} item(s) in ${duration}ms!`);
    response.results.forEach((result, idx) => {
      console.log(`\nInput #${idx + 1}: "${input[idx]}"`);
      console.log(` • Flagged: ${result.flagged ? '⚠️ YES' : '✅ NO'}`);
      const flaggedCategories = Object.entries(result.categories)
        .filter(([_, flagged]) => flagged)
        .map(([cat]) => cat);

      if (flaggedCategories.length > 0) {
        console.log(` • Triggered Categories: ${flaggedCategories.join(', ')}`);
      }

      // Display top scores
      const sortedScores = Object.entries(result.category_scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      console.log(` • Top Category Scores: ${sortedScores.map(([cat, score]) => `${cat}: ${(score * 100).toFixed(2)}%`).join(' | ')}`);
    });
  } catch (error: any) {
    console.error('\n[Error]:', error.message || error);
    if (error.status) console.error(`HTTP Status: ${error.status}`);
  }
}

main();
