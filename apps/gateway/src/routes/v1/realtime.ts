import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { createOpenAIError } from '@ai-gateway/core';

/**
 * Experimental realtime text WebSocket.
 * Not a full OpenAI Realtime API peer; outside the curated compatibility catalog.
 */
export const v1RealtimeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/v1/realtime',
    {
      websocket: true,
      preHandler: async (req, reply) => {
        let authHeader = req.headers['authorization'];
        let apiKey = '';
        if (authHeader && authHeader.startsWith('Bearer ')) {
          apiKey = authHeader.slice(7).trim();
        } else if (req.query && (req.query as any).api_key) {
          apiKey = (req.query as any).api_key;
        }

        const keyMeta = fastify.routingCache.validateGatewayKey(apiKey);
        if (!keyMeta) {
          return reply.status(401).send(
            createOpenAIError('Invalid API key provided for Realtime session.', 401, 'invalid_api_key')
          );
        }
      },
    },
    (socket, req) => {
      const sessionId = `sess_${crypto.randomBytes(12).toString('hex')}`;
      const queryModel = (req.query as any)?.model || 'gpt-4o-realtime-preview';

      let currentSession = {
        id: sessionId,
        object: 'realtime.session',
        model: queryModel,
        modalities: ['text', 'audio'],
        instructions: 'You are a helpful assistant.',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: null,
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        tools: [],
        tool_choice: 'auto',
        temperature: 0.8,
        max_response_output_tokens: 'inf',
      };

      // Emit session.created
      socket.send(
        JSON.stringify({
          event_id: `event_${crypto.randomBytes(8).toString('hex')}`,
          type: 'session.created',
          session: currentSession,
        })
      );

      socket.on('message', (data: Buffer | string) => {
        try {
          const event = JSON.parse(data.toString());

          if (event.type === 'session.update') {
            currentSession = {
              ...currentSession,
              ...event.session,
            };
            socket.send(
              JSON.stringify({
                event_id: `event_${crypto.randomBytes(8).toString('hex')}`,
                type: 'session.updated',
                session: currentSession,
              })
            );
          } else if (event.type === 'response.create') {
            const respId = `resp_${crypto.randomBytes(8).toString('hex')}`;
            const itemId = `item_${crypto.randomBytes(8).toString('hex')}`;

            socket.send(
              JSON.stringify({
                event_id: `event_${crypto.randomBytes(8).toString('hex')}`,
                type: 'response.created',
                response: {
                  id: respId,
                  object: 'realtime.response',
                  status: 'in_progress',
                },
              })
            );

            socket.send(
              JSON.stringify({
                event_id: `event_${crypto.randomBytes(8).toString('hex')}`,
                type: 'response.output_item.added',
                response_id: respId,
                output_index: 0,
                item: {
                  id: itemId,
                  object: 'realtime.item',
                  type: 'message',
                  status: 'in_progress',
                  role: 'assistant',
                  content: [],
                },
              })
            );

            socket.send(
              JSON.stringify({
                event_id: `event_${crypto.randomBytes(8).toString('hex')}`,
                type: 'response.content_part.added',
                response_id: respId,
                output_index: 0,
                content_index: 0,
                part: {
                  type: 'text',
                  text: 'Realtime session active.',
                },
              })
            );

            socket.send(
              JSON.stringify({
                event_id: `event_${crypto.randomBytes(8).toString('hex')}`,
                type: 'response.output_item.done',
                response_id: respId,
                output_index: 0,
                item: {
                  id: itemId,
                  object: 'realtime.item',
                  type: 'message',
                  status: 'completed',
                  role: 'assistant',
                  content: [{ type: 'text', text: 'Realtime session active.' }],
                },
              })
            );

            socket.send(
              JSON.stringify({
                event_id: `event_${crypto.randomBytes(8).toString('hex')}`,
                type: 'response.done',
                response: {
                  id: respId,
                  object: 'realtime.response',
                  status: 'completed',
                  output: [
                    {
                      id: itemId,
                      type: 'message',
                      role: 'assistant',
                      content: [{ type: 'text', text: 'Realtime session active.' }],
                    },
                  ],
                },
              })
            );
          }
        } catch (err) {
          console.error('[Realtime WS] Message parse error:', err);
        }
      });
    }
  );
};
