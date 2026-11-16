#!/usr/bin/env python3
"""
AI Gateway Example: Vector Embeddings (POST /v1/embeddings)

Demonstrates generating vector embeddings using the official OpenAI Python SDK.
Compatible with Matryoshka dimension truncation, batch arrays, and float/base64 encoding.

Usage:
    python examples/python/embeddings_demo.py
"""

import os
import time
from openai import OpenAI

base_url = os.environ.get("GATEWAY_BASE_URL", "http://localhost:3000/v1")
api_key = os.environ.get("GATEWAY_API_KEY", "sk-gw-test-key")
model = os.environ.get("GATEWAY_EMBEDDING_MODEL", "text-embedding-3-small")

client = OpenAI(
    base_url=base_url,
    api_key=api_key,
)

def main():
    print(f"[AI Gateway] Connecting to: {base_url}")
    print(f"[AI Gateway] Embedding Model: {model}")
    print("--- Requesting Vector Embeddings ---\n")

    input_texts = [
        "Zero-DB in-memory routing delivers sub-millisecond AI proxy performance.",
        "Serverless Postgres provides instant auto-scaling for asynchronous request telemetry.",
    ]

    start_time = time.time()

    try:
        response = client.embeddings.create(
            model=model,
            input=input_texts,
        )

        duration_ms = int((time.time() - start_time) * 1000)

        print(f"[Success] Generated {len(response.data)} vector embeddings in {duration_ms}ms:")
        for item in response.data:
            sample = [f"{v:.4f}" for v in item.embedding[:4]]
            print(f" • Index {item.index}: dimensions = {len(item.embedding)}, head = [{', '.join(sample)}...]")

        if response.usage:
            print(f"\nUsage: {response.usage.prompt_tokens} prompt tokens")

    except Exception as e:
        print(f"[Error]: {e}")

if __name__ == "__main__":
    main()
