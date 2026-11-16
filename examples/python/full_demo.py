#!/usr/bin/env python3
"""
AI Gateway Example: Full Multi-Modal Pipeline (Python)

Demonstrates end-to-end integration:
  1. Inspect active models list (/v1/models)
  2. Stream conversational Chat Completion tokens in real time (/v1/chat/completions)
  3. Stream audio synthesis of the assistant's answer (/v1/audio/speech)

Usage:
    python examples/python/full_demo.py
"""

import os
import sys
import time
from openai import OpenAI

base_url = os.environ.get("GATEWAY_BASE_URL", "http://localhost:3000/v1")
api_key = os.environ.get("GATEWAY_API_KEY", "sk-gw-test-key")
chat_model = os.environ.get("GATEWAY_MODEL", "groq/llama-3.3-70b-versatile")
tts_model = os.environ.get("GATEWAY_TTS_MODEL", "eleven_flash_v2_5")
voice_id = os.environ.get("GATEWAY_TTS_VOICE", "JBFqnCBsd6RMkjVDRZzb") # George (Premade Free)

client = OpenAI(
    base_url=base_url,
    api_key=api_key,
)

def main():
    print("========================================================")
    print("   AI GATEWAY PYTHON MULTI-MODAL PIPELINE")
    print("========================================================")
    print(f"Gateway URL: {base_url}\n")

    # Step 1: List Models
    print(">>> Step 1: Querying Registered Models (/v1/models)...")
    try:
        models = client.models.list()
        print(f"Discovered {len(models.data)} active models:")
        for m in models.data[:5]:
            print(f"  • {m.id} (provider: {m.owned_by})")
        if len(models.data) > 5:
            print(f"  ... and {len(models.data) - 5} more.")
    except Exception as e:
        print(f"Note: Could not query /v1/models: {e}")

    # Step 2: Stream Chat Completion
    print("\n>>> Step 2: Streaming Chat Completion (/v1/chat/completions)...")
    prompt = "Why is an in-memory routing cache faster than querying a database? One sentence."
    print(f'User: "{prompt}"')

    assistant_text = ""
    start_time = time.time()
    first_token_time = None

    try:
        stream = client.chat.completions.create(
            model=chat_model,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )

        sys.stdout.write("Assistant: ")
        sys.stdout.flush()

        for chunk in stream:
            if first_token_time is None:
                first_token_time = time.time()
            content = chunk.choices[0].delta.content if chunk.choices else ""
            if content:
                sys.stdout.write(content)
                sys.stdout.flush()
                assistant_text += content

        total_ms = int((time.time() - start_time) * 1000)
        ttft_ms = int((first_token_time - start_time) * 1000) if first_token_time else 0
        print(f"\n[Chat Stream Finished: {total_ms}ms | TTFT: {ttft_ms}ms]")
    except Exception as e:
        print(f"Chat streaming error: {e}")
        assistant_text = "In-memory caching avoids network latency and disk I/O by resolving routes in microsecond RAM lookups."

    # Step 3: Stream Text-to-Speech
    print("\n>>> Step 3: Streaming Speech Synthesis (/v1/audio/speech)...")
    print(f"TTS Model: {tts_model} | Voice ID: {voice_id}")
    output_audio = "python-pipeline-output.mp3"

    try:
        tts_start = time.time()
        with client.audio.speech.with_streaming_response.create(
            model=tts_model,
            voice=voice_id,
            input=assistant_text,
        ) as response:
            with open(output_audio, "wb") as f:
                for chunk in response.iter_bytes():
                    f.write(chunk)

        tts_ms = int((time.time() - tts_start) * 1000)
        size_kb = os.path.getsize(output_audio) / 1024
        print(f"[TTS Stream Finished: {tts_ms}ms | File Size: {size_kb:.1f} KB]")
        print(f"Audio Output: {os.path.abspath(output_audio)}")
    except Exception as e:
        print(f"TTS error: {e}")

    print("\n========================================================")
    print("   END-TO-END PIPELINE COMPLETED")
    print("========================================================\n")

if __name__ == "__main__":
    main()
