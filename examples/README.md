# AI Gateway Integration Examples

Examples for the curated OpenAI-compatible surfaces. Point the official **OpenAI SDK** (`openai` for Node.js / Python) or plain `cURL` at the gateway `baseURL`.

This gateway is **stateless** for generation and does **not** support Files, Batches, Vector Stores, Assistants, Fine-tuning, or Conversations. See the root [README compatibility catalog](../README.md#compatibility-catalog).

---

## Supported Endpoints & Modes

| Resource / Route | Capability / Mode | Node.js Example | Python Example | Protocol |
| :--- | :--- | :--- | :--- | :--- |
| `POST /v1/chat/completions` | Non-streamed chat | [chat-non-streamed.ts](nodejs/chat-non-streamed.ts) | [chat_non_streamed.py](python/chat_non_streamed.py) | HTTP JSON |
| `POST /v1/chat/completions` | Streamed (SSE) | [chat-streamed.ts](nodejs/chat-streamed.ts) | [chat_streamed.py](python/chat_streamed.py) | SSE |
| `POST /v1/responses` | Stateless Responses | [responses-demo.ts](nodejs/responses-demo.ts) | [responses_demo.py](python/responses_demo.py) | HTTP & SSE |
| `POST /v1/embeddings` | Vector embeddings | [embeddings-demo.ts](nodejs/embeddings-demo.ts) | [embeddings_demo.py](python/embeddings_demo.py) | HTTP JSON |
| `POST /v1/images/generations` | Image generation | [images-demo.ts](nodejs/images-demo.ts) | [images_demo.py](python/images_demo.py) | HTTP JSON |
| `POST /v1/moderations` | Safety moderation | [moderations-demo.ts](nodejs/moderations-demo.ts) | [moderations_demo.py](python/moderations_demo.py) | HTTP JSON |

## Experimental (not curated)

| Resource / Route | Notes | Examples |
| :--- | :--- | :--- |
| `POST /v1/audio/speech` | TTS — experimental | [tts-non-streamed.ts](nodejs/tts-non-streamed.ts) |
| `POST /v1/audio/transcriptions` | STT — experimental | [stt-transcription.ts](nodejs/stt-transcription.ts) |
| `GET /v1/realtime` | Experimental WS — not OpenAI Realtime parity | [realtime-demo.ts](nodejs/realtime-demo.ts) |

## Unsupported (return 501)

Files, Uploads, Batches, Vector Stores, Assistants/Threads, Fine-tuning — demos under those names may exist historically but the gateway rejects these APIs with `unsupported_resource`.

---

## Configuration & Environment Variables

```bash
export GATEWAY_BASE_URL="http://localhost:3000/v1"
export GATEWAY_API_KEY="sk-gw-YOUR_KEY"
export GATEWAY_MODEL="groq/llama-3.3-70b-versatile"
```

Generate a gateway key in the admin dashboard at `/keys`.
