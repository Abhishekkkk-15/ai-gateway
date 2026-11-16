"""
AI Gateway Example: Next-Gen Responses API (POST /v1/responses)

Demonstrates the flagship Responses API (`client.responses.create`) from OpenAI's
latest Python SDK, including direct `output_text` accessor and stateful continuation.

Usage:
    python examples/python/responses_demo.py
"""

import os
from openai import OpenAI

BASE_URL = os.environ.get("GATEWAY_BASE_URL", "http://localhost:3000/v1")
API_KEY = os.environ.get("GATEWAY_API_KEY", "sk-gw-test-key")
MODEL = os.environ.get("GATEWAY_CHAT_MODEL", "groq/llama-3.3-70b-versatile")

client = OpenAI(
    base_url=BASE_URL,
    api_key=API_KEY,
)

def main():
    print(f"[AI Gateway] Connecting to: {BASE_URL}")
    print(f"[AI Gateway] Model: {MODEL}")
    print("--- Next-Gen Responses API Demo ---\n")

    try:
        # 1. Turn 1
        print("1. Prompting via Responses API...")
        # Fallback to direct client post if sdk client.responses is typed in newest releases
        resp1 = client.post(
            "/responses",
            cast_to=dict,
            body={
                "model": MODEL,
                "input": "Explain the benefit of an in-memory routing cache in 2 sentences.",
                "instructions": "You are an ultra-concise systems architect.",
            },
        )

        print(f"[Success] Response ID: {resp1.get('id')}")
        print(f" • Output Text: {resp1.get('output_text')}")
        print(f" • Total Tokens: {resp1.get('usage', {}).get('total_tokens')}")

        # 2. Turn 2 Chaining previous_response_id
        print("\n2. Chaining continuation turn via previous_response_id...")
        resp2 = client.post(
            "/responses",
            cast_to=dict,
            body={
                "model": MODEL,
                "input": "Now give me the single biggest trade-off.",
                "previous_response_id": resp1.get('id'),
            },
        )

        print(f"[Success] Continuation Response ID: {resp2.get('id')}")
        print(f" • Output Text: {resp2.get('output_text')}")

    except Exception as e:
        print(f"\n[Error]: {e}")

if __name__ == "__main__":
    main()
