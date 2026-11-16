/**
 * AI Gateway Example: Realtime API Bidirectional WebSocket Bridge (/v1/realtime)
 *
 * Demonstrates connecting to the ultra-low-latency bidirectional Realtime API
 * using standard WebSockets.
 *
 * Usage:
 *   npx tsx examples/nodejs/realtime-demo.ts
 */

import WebSocket from 'ws';

const baseURL = process.env.GATEWAY_BASE_URL || 'http://localhost:3000/v1';
const apiKey = process.env.GATEWAY_API_KEY || 'sk-gw-test-key';
const model = process.env.GATEWAY_REALTIME_MODEL || 'gpt-4o-realtime-preview';

// Convert http/https URL to ws/wss URL
const wsURL = baseURL.replace(/^http/, 'ws') + `/realtime?model=${encodeURIComponent(model)}`;

async function main() {
  console.log(`[AI Gateway] Connecting to Realtime WebSocket: ${wsURL}`);
  console.log('--- Realtime API Bidirectional WebSocket Demo ---\n');

  const ws = new WebSocket(wsURL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  ws.on('open', () => {
    console.log('[Connected] WebSocket handshake established.');

    // 1. Update session settings
    console.log('\n1. Sending session.update event...');
    ws.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text'],
          instructions: 'You are an ultra-fast streaming assistant.',
        },
      })
    );
  });

  ws.on('message', (data) => {
    const event = JSON.parse(data.toString());
    console.log(` ← Received event: "${event.type}"`);

    if (event.type === 'session.updated') {
      console.log('\n2. Triggering assistant response turn (response.create)...');
      ws.send(
        JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['text'],
            instructions: 'Say: Realtime bidirectional WebSocket bridge verified.',
          },
        })
      );
    }

    if (event.type === 'response.done') {
      console.log('\n[Success] Response turn finished! Closing connection.');
      ws.close();
      process.exit(0);
    }
  });

  ws.on('error', (err) => {
    console.error('[WebSocket Error]:', err.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`[Closed] Code: ${code}, Reason: ${reason || 'normal closure'}`);
  });
}

main();
