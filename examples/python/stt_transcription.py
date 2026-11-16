#!/usr/bin/env python3
"""
AI Gateway Example: Speech-to-Text Transcription (Python)

Demonstrates transcribing audio via the OpenAI audio transcriptions endpoint.
The AI Gateway routes the multipart form-data to Whisper (Groq/Nvidia) or Scribe (ElevenLabs).

Usage:
    python examples/python/stt_transcription.py [path/to/audio.mp3]
"""

import os
import sys
import time
import wave
import struct
from openai import OpenAI

base_url = os.environ.get("GATEWAY_BASE_URL", "http://localhost:3000/v1")
api_key = os.environ.get("GATEWAY_API_KEY", "sk-gw-test-key")
# Model can be 'whisper-large-v3-turbo', 'scribe_v1', or custom alias
model = os.environ.get("GATEWAY_STT_MODEL", "whisper-large-v3-turbo")

client = OpenAI(
    base_url=base_url,
    api_key=api_key,
)

def create_dummy_wav(filepath: str):
    """Creates a minimal 1-second 8kHz mono WAV file for testing if no file is provided."""
    sample_rate = 8000
    duration = 1.0
    num_frames = int(sample_rate * duration)
    with wave.open(filepath, "w") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        # 1-second silence/beep
        data = struct.pack(f"<{num_frames}h", *([0] * num_frames))
        wav_file.writeframes(data)

def main():
    target_file = sys.argv[1] if len(sys.argv) > 1 else None

    if not target_file or not os.path.exists(target_file):
        for candidate in ["speech-python-streamed.mp3", "speech-streamed.mp3", "speech-non-streamed.mp3"]:
            if os.path.exists(candidate):
                target_file = candidate
                break

    if not target_file or not os.path.exists(target_file):
        target_file = "sample-python-test-audio.wav"
        create_dummy_wav(target_file)
        print(f"[Notice] Created test audio file at: {target_file}")

    print(f"[AI Gateway] Connecting to: {base_url}")
    print(f"[AI Gateway] STT Model: {model}")
    print(f"[Audio File]: {os.path.abspath(target_file)}")
    print("--- Sending Audio Transcription Request ---\n")

    start_time = time.time()

    try:
        with open(target_file, "rb") as audio_file:
            response = client.audio.transcriptions.create(
                model=model,
                file=audio_file,
            )

        duration_ms = int((time.time() - start_time) * 1000)

        print("[Transcription Result]:")
        print(response.text if hasattr(response, "text") and response.text else "(No text transcribed)")

        print("\n--- Telemetry ---")
        print(f"Total Latency: {duration_ms}ms")

    except Exception as e:
        print(f"[Error]: {e}")

if __name__ == "__main__":
    main()
