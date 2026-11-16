"""
AI Gateway Example: Images Generation (POST /v1/images/generations)

Demonstrates generating images using the official OpenAI Python SDK.
Compatible with standard prompt generation, size parameters, quality, style,
and both URL and base64 formats.

Usage:
    python examples/python/images_demo.py
"""

import os
import time
from openai import OpenAI

BASE_URL = os.environ.get("GATEWAY_BASE_URL", "http://localhost:3000/v1")
API_KEY = os.environ.get("GATEWAY_API_KEY", "sk-gw-test-key")
MODEL = os.environ.get("GATEWAY_IMAGE_MODEL", "dall-e-3")

client = OpenAI(
    base_url=BASE_URL,
    api_key=API_KEY,
)

def main():
    print(f"[AI Gateway] Connecting to: {BASE_URL}")
    print(f"[AI Gateway] Image Model: {MODEL}")
    print("--- Generating Image ---\n")

    start_time = time.time()

    try:
        prompt = "A futuristic neon cybernetic observatory under a galaxy of stars, digital art"
        response = client.images.generate(
            model=MODEL,
            prompt=prompt,
            size="1024x1024",
            quality="hd",
            n=1,
        )

        duration_ms = (time.time() - start_time) * 1000

        print(f"[Success] Generated {len(response.data)} image(s) in {duration_ms:.1f}ms!")
        for item in response.data:
            if item.url:
                print(f" • Image URL: {item.url}")
            elif item.b64_json:
                print(f" • Base64 payload length: {len(item.b64_json)} characters")
            if getattr(item, "revised_prompt", None):
                print(f" • Revised Prompt: {item.revised_prompt}")

    except Exception as e:
        print(f"\n[Error]: {e}")

if __name__ == "__main__":
    main()
