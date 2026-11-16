# AI Gateway Integration Examples

This directory contains production-ready examples demonstrating **100% drop-in compatibility** between the AI Gateway and official client libraries. You do not need to install custom client libraries—use the standard **OpenAI SDK** (`openai` for Node.js / Python) or plain `cURL`.

---

## Supported Endpoints & Modes

| Route | Mode | Node.js Example | Python Example | cURL Command |
| :--- | :--- | :--- | :--- | :--- |
| `POST /v1/chat/completions` | **Non-Streamed** | [chat-non-streamed.ts](nodejs/chat-non-streamed.ts) | [chat_non_streamed.py](python/chat_non_streamed.py) | `curl -s ... /chat/completions` |
| `POST /v1/chat/completions` | **Streamed (SSE)** | [chat-streamed.ts](nodejs/chat-streamed.ts) | [chat_streamed.py](python/chat_streamed.py) | `curl -N ... /chat/completions` |
| `POST /v1/audio/speech` | **Non-Streamed** | [tts-non-streamed.ts](nodejs/tts-non-streamed.ts) | [tts_non_streamed.py](python/tts_non_streamed.py) | `curl ... /audio/speech --output file.mp3` |
| `POST /v1/audio/speech` | **Streamed** | [tts-streamed.ts](nodejs/tts-streamed.ts) | [tts_streamed.py](python/tts_streamed.py) | `curl -N ... /audio/speech` |
| `POST /v1/audio/transcriptions` | **Audio STT** | [stt-transcription.ts](nodejs/stt-transcription.ts) | [stt_transcription.py](python/stt_transcription.py) | `curl -F "file=@..." /audio/transcriptions` |
| **Full Pipeline** | **Multi-Modal** | [full-demo.ts](nodejs/full-demo.ts) | [full_demo.py](python/full_demo.py) | End-to-End Chat + Audio |

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
