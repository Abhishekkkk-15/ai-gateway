#!/usr/bin/env bash
# ==============================================================================
# AI Gateway: OpenAI-Compatible cURL Quick Reference Examples
#
# Replace GATEWAY_KEY with your gateway token (e.g. sk-gw-...)
# ==============================================================================

GATEWAY_URL="http://localhost:3000/v1"
GATEWAY_KEY="sk-gw-test-key"

echo "=== 1. List Active Routable Models ==="
curl -s "${GATEWAY_URL}/models" \
  -H "Authorization: Bearer ${GATEWAY_KEY}" \
  | jq .

echo -e "\n=== 2. Non-Streamed Chat Completion ==="
curl -s "${GATEWAY_URL}/chat/completions" \
  -H "Authorization: Bearer ${GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "groq/llama-3.3-70b-versatile",
    "messages": [
      {"role": "user", "content": "What is an in-memory routing cache in 1 sentence?"}
    ],
    "stream": false
  }' | jq .

echo -e "\n=== 3. Streamed Chat Completion (SSE) ==="
curl -N "${GATEWAY_URL}/chat/completions" \
  -H "Authorization: Bearer ${GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "groq/llama-3.3-70b-versatile",
    "messages": [
      {"role": "user", "content": "Count from 1 to 5 with emojis."}
    ],
    "stream": true
  }'

echo -e "\n\n=== 4. Text-to-Speech (Non-Streamed / Save to File) ==="
curl -s "${GATEWAY_URL}/audio/speech" \
  -H "Authorization: Bearer ${GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "eleven_flash_v2_5",
    "voice": "JBFqnCBsd6RMkjVDRZzb",
    "input": "This is a non-streamed speech test from cURL."
  }' --output curl-speech-output.mp3
echo "Audio saved to curl-speech-output.mp3"

echo -e "\n=== 5. Text-to-Speech (Chunked Stream) ==="
curl -N "${GATEWAY_URL}/audio/speech" \
  -H "Authorization: Bearer ${GATEWAY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "eleven_flash_v2_5",
    "voice": "21m00Tcm4TlvDq8ikWAM",
    "input": "This is a real-time streaming audio response test."
  }' --output curl-streamed-output.mp3
echo "Streaming audio saved to curl-streamed-output.mp3"

echo -e "\n=== 6. Speech-to-Text Transcription ==="
# Provide an audio file (e.g. curl-speech-output.mp3 or sample.mp3)
AUDIO_FILE="curl-speech-output.mp3"
if [ -f "${AUDIO_FILE}" ]; then
  curl -s "${GATEWAY_URL}/audio/transcriptions" \
    -H "Authorization: Bearer ${GATEWAY_KEY}" \
    -F "file=@${AUDIO_FILE}" \
    -F "model=whisper-large-v3-turbo" \
    | jq .
else
  echo "Run step 4 first to generate ${AUDIO_FILE} for STT transcription."
fi
