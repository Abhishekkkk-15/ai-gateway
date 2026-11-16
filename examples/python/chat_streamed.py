#!/usr/bin/env python3
"""
AI Gateway Example: Streamed Chat Completion (Python SSE)

Demonstrates real-time Server-Sent Events (SSE) token streaming via the OpenAI Python SDK.
Measures Time-To-First-Token (TTFT) and token streaming rate.

Usage:
    python examples/python/chat_streamed.py
"""

import os
import sys
import time
from openai import OpenAI

base_url = os.environ.get("GATEWAY_BASE_URL", "http://localhost:3000/v1")
api_key = os.environ.get("GATEWAY_API_KEY", "sk-gw-test-key")
model = os.environ.get("GATEWAY_MODEL", "groq/llama-3.3-70b-versatile")

client = OpenAI(
    base_url=base_url,
    api_key=api_key,
)

def main():
    print(f"[AI Gateway] Connecting to: {base_url}")
    print(f"[AI Gateway] Target Model: {model}")
    print("--- Initiating Real-Time Token Stream ---\n")

    start_time = time.time()
    first_token_time = None
    token_count = 0

    try:
        stream = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI infrastructure architect.",
                },
                {
                    "role": "user",
                    "content": "Give 3 reasons why an edge routing layer improves LLM resilience across multiple upstream providers.",
                },
            ],
            stream=True,
        )

        sys.stdout.write("[Stream Output]:\n")
        sys.stdout.flush()

        for chunk in stream:
            if first_token_time is None:
                first_token_time = time.time()

            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                sys.stdout.write(delta)
                sys.stdout.flush()
                token_count += 1

        total_duration_ms = int((time.time() - start_time) * 1000)
        ttft_ms = int((first_token_time - start_time) * 1000) if first_token_time else None

        print("\n\n--- Streaming Performance Telemetry ---")
        print(f"Time-To-First-Token (TTFT): {f'{ttft_ms}ms' if ttft_ms is not None else 'N/A'}")
        print(f"Total Duration: {total_duration_ms}ms")
        print(f"Streamed Chunks: {token_count}")
        if ttft_ms is not None and total_duration_ms > ttft_ms:
            tps = (token_count / (total_duration_ms - ttft_ms)) * 1000
            print(f"Stream Throughput: ~{tps:.1f} chunks/sec")

    except Exception as e:
        print(f"\n[Error]: {e}")

if __name__ == "__main__":
    main()
