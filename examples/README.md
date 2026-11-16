# AI Gateway Integration Examples

This directory contains production-ready examples demonstrating **100% drop-in compatibility** between the AI Gateway and official client libraries. You do not need to install custom client libraries—use the standard **OpenAI SDK** (`openai` for Node.js / Python) or plain `cURL`.

---

## Supported Endpoints & Modes

| Resource / Route | Capability / Mode | Node.js Example | Python Example | cURL / Protocol |
| :--- | :--- | :--- | :--- | :--- |
| `POST /v1/chat/completions` | **Non-Streamed Chat** | [chat-non-streamed.ts](nodejs/chat-non-streamed.ts) | [chat_non_streamed.py](python/chat_non_streamed.py) | HTTP JSON |
| `POST /v1/chat/completions` | **Streamed (SSE)** | [chat-streamed.ts](nodejs/chat-streamed.ts) | [chat_streamed.py](python/chat_streamed.py) | Server-Sent Events |
| `POST /v1/responses` | **Next-Gen Responses** | [responses-demo.ts](nodejs/responses-demo.ts) | [responses_demo.py](python/responses_demo.py) | HTTP & SSE Stream |
| `POST /v1/embeddings` | **Vector Embeddings** | [embeddings-demo.ts](nodejs/embeddings-demo.ts) | [embeddings_demo.py](python/embeddings_demo.py) | HTTP JSON |
| `POST /v1/images/generations` | **Image Generation** | [images-demo.ts](nodejs/images-demo.ts) | [images_demo.py](python/images_demo.py) | HTTP JSON / URL / b64 |
| `POST /v1/moderations` | **Safety Moderation** | [moderations-demo.ts](nodejs/moderations-demo.ts) | [moderations_demo.py](python/moderations_demo.py) | HTTP JSON |
| `POST /v1/files` | **File Storage & Datasets** | [files-demo.ts](nodejs/files-demo.ts) | [files_demo.py](python/files_demo.py) | Multipart / Streams |
| `POST /v1/batches` | **24h Async Batches** | [batches-demo.ts](nodejs/batches-demo.ts) | [batches_demo.py](python/batches_demo.py) | HTTP JSONL |
| `POST /v1/vector_stores` | **Vector Retrieval (RAG)** | [vector-stores-demo.ts](nodejs/vector-stores-demo.ts) | [vector_stores_demo.py](python/vector_stores_demo.py) | HTTP JSON |
| `POST /v1/assistants` & `/threads` | **Assistants v2 Agents** | [assistants-v2-demo.ts](nodejs/assistants-v2-demo.ts) | [assistants_v2_demo.py](python/assistants_v2_demo.py) | Stateful Runs |
| `GET /v1/realtime` | **Realtime API (WebSockets)** | [realtime-demo.ts](nodejs/realtime-demo.ts) | [realtime_demo.py](python/realtime_demo.py) | Bidirectional WebSocket |
| `POST /v1/fine_tuning/jobs` | **Model Fine-Tuning** | [fine-tuning-demo.ts](nodejs/fine-tuning-demo.ts) | [fine_tuning_demo.py](python/fine_tuning_demo.py) | HTTP JSON |
| `POST /v1/audio/speech` | **Audio TTS (Stream & MP3)**| [tts-non-streamed.ts](nodejs/tts-non-streamed.ts) | [tts_non_streamed.py](python/tts_non_streamed.py) | Binary Audio Stream |
| `POST /v1/audio/transcriptions` | **Audio STT Transcription** | [stt-transcription.ts](nodejs/stt-transcription.ts) | [stt_transcription.py](python/stt_transcription.py) | Multipart Audio |
| **Full Pipeline** | **Multi-Modal End-to-End** | [full-demo.ts](nodejs/full-demo.ts) | [full_demo.py](python/full_demo.py) | Multi-modal Pipeline |

---

## Configuration & Environment Variables

All examples read from standard environment variables with sensible defaults:

```bash
# Gateway Connection
export GATEWAY_BASE_URL="http://localhost:3000/v1"
export GATEWAY_API_KEY="sk-gw-YOUR_KEY" # Generate in the admin dashboard at /keys

# Model Configuration
export GATEWAY_MODEL="groq/llama-3.3-70b-versatile" # Or routable alias e.g. "fast-chat"
export GATEWAY_TTS_MODEL="eleven_flash_v2_5"       # Or "eleven_multilingual_v2", "tts-1"
export GATEWAY_TTS_VOICE="JBFqnCBsd6RMkjVDRZzb"   # George (Premade Free) or Rachel
export GATEWAY_STT_MODEL="whisper-large-v3-turbo"  # Or "scribe_v1"
```

> [!NOTE]
> **ElevenLabs Voice Selection Note**:
> Free ElevenLabs accounts can use **Default Premade Voices** (George: `JBFqnCBsd6RMkjVDRZzb`, Rachel: `21m00Tcm4TlvDq8ikWAM`, Sarah: `EXAVITQu4vr4xnSDxMaL`, Roger: `CwhRBWXzGAHq8TQ4Fs17`, Liam: `TX3LPaxmHKxFdv7VOQHJ`, Alice: `Xb7hH8MSUJpSbSDYk0k2`) without restrictions. Community Voice Library voices require a paid ElevenLabs plan.

---

## Running Node.js Examples

Node.js v22+ executes TypeScript directly using `--experimental-strip-types`, or via `tsx`:

```bash
# 1. Non-streamed Chat Completion
node --experimental-strip-types examples/nodejs/chat-non-streamed.ts

# 2. Streamed Chat Completion (SSE with TTFT metrics)
node --experimental-strip-types examples/nodejs/chat-streamed.ts

# 3. Non-streamed Text-to-Speech (Writes speech-non-streamed.mp3)
node --experimental-strip-types examples/nodejs/tts-non-streamed.ts

# 4. Streamed Text-to-Speech (Chunked real-time stream)
node --experimental-strip-types examples/nodejs/tts-streamed.ts

# 5. Speech-to-Text Transcription
node --experimental-strip-types examples/nodejs/stt-transcription.ts

# 6. Complete End-to-End Pipeline Demo (Chat + TTS Streaming)
node --experimental-strip-types examples/nodejs/full-demo.ts
```

---

## Running Python Examples

Install the standard `openai` library:

```bash
pip install -r examples/python/requirements.txt
```

Run any example directly:

```bash
# 1. Non-streamed Chat Completion
python examples/python/chat_non_streamed.py

# 2. Streamed Chat Completion (SSE with live token flushing & TTFT)
python examples/python/chat_streamed.py

# 3. Non-streamed Text-to-Speech (response.write_to_file)
python examples/python/tts_non_streamed.py

# 4. Streamed Text-to-Speech (response.iter_bytes)
python examples/python/tts_streamed.py

# 5. Speech-to-Text Audio Transcription
python examples/python/stt_transcription.py

# 6. Complete End-to-End Multi-Modal Pipeline
python examples/python/full_demo.py
```

---

## Running cURL Examples

You can run the interactive shell script:

```bash
bash examples/curl/requests.sh
```

Or individual commands:

```bash
# Stream Chat with SSE
curl -N http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-gw-YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "groq/llama-3.3-70b-versatile",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'

# Stream Audio Speech
curl -N http://localhost:3000/v1/audio/speech \
  -H "Authorization: Bearer sk-gw-YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "eleven_flash_v2_5",
    "voice": "JBFqnCBsd6RMkjVDRZzb",
    "input": "Streaming speech output from the AI Gateway."
  }' --output output.mp3
```
