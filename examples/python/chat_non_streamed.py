#!/usr/bin/env python3
"""
AI Gateway Example: Non-Streamed Chat Completion (Python)

Demonstrates using the official OpenAI Python SDK directly against the AI Gateway.
The gateway authenticates the gateway token, looks up the model in the zero-DB memory
routing cache, and proxies to the upstream provider with < 1ms routing overhead.

Usage:
    python examples/python/chat_non_streamed.py
"""

import os
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
    print("--- Sending Non-Streamed Chat Completion Request ---\n")

    start_time = time.time()

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a concise, helpful assistant explaining high-performance networking.",
                },
                {
                    "role": "user",
                    "content": "Explain why avoiding database lookups on the hot routing path is crucial for AI gateways.",
                },
            ],
            temperature=0.7,
            stream=False,
        )

        duration_ms = int((time.time() - start_time) * 1000)
        choice = response.choices[0]

        print("[Response Content]:")
        print(choice.message.content)

        print("\n--- Telemetry ---")
        print(f"Total Latency: {duration_ms}ms")
        if response.usage:
            print(f"Prompt Tokens: {response.usage.prompt_tokens}")
            print(f"Completion Tokens: {response.usage.completion_tokens}")
            print(f"Total Tokens: {response.usage.total_tokens}")

    except Exception as e:
        print(f"[Error]: {e}")

if __name__ == "__main__":
    main()
