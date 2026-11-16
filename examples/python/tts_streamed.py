#!/usr/bin/env python3
"""
AI Gateway Example: Streamed Text-to-Speech (Python)

Demonstrates progressive audio chunk streaming via with_streaming_response.
As ElevenLabs synthesizes tokens, binary audio chunks stream back through the
gateway with sub-100ms Time-to-First-Audio (TTFA).

Usage:
    python examples/python/tts_streamed.py
"""

import os
import sys
import time
from openai import OpenAI

base_url = os.environ.get("GATEWAY_BASE_URL", "http://localhost:3000/v1")
api_key = os.environ.get("GATEWAY_API_KEY", "sk-gw-test-key")
model = os.environ.get("GATEWAY_TTS_MODEL", "eleven_flash_v2_5")
# Default premade voice (Free tier supported): Rachel (21m00Tcm4TlvDq8ikWAM) or George (JBFqnCBsd6RMkjVDRZzb)
voice = os.environ.get("GATEWAY_TTS_VOICE", "21m00Tcm4TlvDq8ikWAM")

client = OpenAI(
    base_url=base_url,
    api_key=api_key,
)

def main():
    text_input = (
        "Streaming audio chunks over chunked HTTP transfer encoding drastically lowers interactive voice response latency."
    )
    output_file = "speech-python-streamed.mp3"

    print(f"[AI Gateway] Connecting to: {base_url}")
    print(f"[AI Gateway] TTS Model: {model} | Voice ID: {voice}")
    print(f'[Input Text]: "{text_input}"')
    print("--- Initiating Real-Time Audio Stream ---\n")

    start_time = time.time()
    first_chunk_time = None
    total_bytes = 0
    chunk_count = 0

    try:
        with client.audio.speech.with_streaming_response.create(
            model=model,
            voice=voice,
            input=text_input,
        ) as response:
            with open(output_file, "wb") as f:
                for chunk in response.iter_bytes(chunk_size=1024):
                    if first_chunk_time is None:
                        first_chunk_time = time.time()

                    total_bytes += len(chunk)
                    chunk_count += 1
                    f.write(chunk)

                    sys.stdout.write(f"\rReceived chunk #{chunk_count} ({total_bytes} bytes)...")
                    sys.stdout.flush()

        total_duration_ms = int((time.time() - start_time) * 1000)
        ttfa_ms = int((first_chunk_time - start_time) * 1000) if first_chunk_time else None
        size_kb = total_bytes / 1024

        print("\n\n--- Streaming Audio Telemetry ---")
        print(f"Time-To-First-Audio (TTFA): {f'{ttfa_ms}ms' if ttfa_ms is not None else 'N/A'}")
        print(f"Total Duration: {total_duration_ms}ms")
        print(f"Total Chunks: {chunk_count} ({size_kb:.2f} KB)")
        print(f"Audio Output saved to: {os.path.abspath(output_file)}")

    except Exception as e:
        print(f"\n[Error]: {e}")

if __name__ == "__main__":
    main()
