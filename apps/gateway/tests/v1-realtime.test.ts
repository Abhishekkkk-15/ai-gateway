import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';
import { hashGatewayKey } from '@ai-gateway/db';
import WebSocket from 'ws';

describe('Realtime API WebSocket Bridge (/v1/realtime)', () => {
  let app: FastifyInstance;
  let port: number;
  const validKey = 'sk-gw-test-valid-key-realtime';
  const keyHash = hashGatewayKey(validKey);

  beforeAll(async () => {
    app = await buildServer({ skipDbHydration: true });
    await app.ready();
    const address = await app.listen({ port: 0 });
    port = (app.server.address() as any).port;

    app.routingCache.setGatewayKeyForTesting(keyHash, {
      id: 'key-rt-1',
      name: 'Test Realtime Key',
      keyHash,
      prefix: 'sk-gw-test',
      createdAt: new Date(),
      isEnabled: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects connection without valid authorization', async () => {
    return new Promise<void>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/realtime`);
      ws.on('unexpected-response', (req, res) => {
        expect(res.statusCode).toBe(401);
        ws.terminate();
        resolve();
      });
      ws.on('error', () => {
        // Handled by unexpected-response
      });
    });
  });

  it('connects, receives session.created, handles session.update, and triggers response.done', async () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/realtime?model=gpt-4o-realtime-preview`, {
        headers: {
          Authorization: `Bearer ${validKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });

      const receivedEvents: string[] = [];

      ws.on('open', () => {
        // Send session.update
        ws.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              voice: 'shimmer',
              modalities: ['text'],
            },
          })
        );
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        receivedEvents.push(msg.type);

        if (msg.type === 'session.updated') {
          // Trigger a response turn
          ws.send(
            JSON.stringify({
              type: 'response.create',
              response: {
                modalities: ['text'],
                instructions: 'Say Realtime Connected',
              },
            })
          );
        }

        if (msg.type === 'response.done') {
          expect(receivedEvents).toContain('session.created');
          expect(receivedEvents).toContain('session.updated');
          expect(receivedEvents).toContain('response.done');
          ws.close();
          resolve();
        }
      });

      ws.on('error', (err) => {
        reject(err);
      });
    });
  });
});
