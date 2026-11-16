"""
AI Gateway Example: Content Moderations (POST /v1/moderations)

Demonstrates evaluating content against safety categories using the official OpenAI Python SDK.
Returns classification flags, categories (hate, harassment, self-harm, sexual, violence),
and fine-grained confidence category scores.

Usage:
    python examples/python/moderations_demo.py
"""

import os
import time
from openai import OpenAI

BASE_URL = os.environ.get("GATEWAY_BASE_URL", "http://localhost:3000/v1")
API_KEY = os.environ.get("GATEWAY_API_KEY", "sk-gw-test-key")
MODEL = os.environ.get("GATEWAY_MODERATION_MODEL", "omni-moderation-latest")

client = OpenAI(
    base_url=BASE_URL,
    api_key=API_KEY,
)

def main():
    print(f"[AI Gateway] Connecting to: {BASE_URL}")
    print(f"[AI Gateway] Moderation Model: {MODEL}")
    print("--- Inspecting Content Safety ---\n")

    start_time = time.time()

    try:
        sample_inputs = [
            "Welcome to the AI Gateway! Fast, reliable, and compliant AI proxy.",
            "I want to hurt people and cause massive chaos everywhere.",
        ]

        response = client.moderations.create(
            model=MODEL,
            input=sample_inputs,
        )

        duration_ms = (time.time() - start_time) * 1000

        print(f"[Success] Evaluated {len(response.results)} item(s) in {duration_ms:.1f}ms!")
        for idx, result in enumerate(response.results):
            print(f"\nInput #{idx + 1}: \"{sample_inputs[idx]}\"")
            print(f" • Flagged: {'⚠️ YES' if result.flagged else '✅ NO'}")
            
            categories_dict = result.categories.model_dump() if hasattr(result.categories, 'model_dump') else vars(result.categories)
            scores_dict = result.category_scores.model_dump() if hasattr(result.category_scores, 'model_dump') else vars(result.category_scores)

            flagged = [cat for cat, val in categories_dict.items() if val]
            if flagged:
                print(f" • Triggered Categories: {', '.join(flagged)}")

            # Top 3 scores
            sorted_scores = sorted(scores_dict.items(), key=lambda kv: kv[1], reverse=True)[:3]
            scores_str = " | ".join(f"{cat}: {score * 100:.2f}%" for cat, score in sorted_scores)
            print(f" • Top Scores: {scores_str}")

    except Exception as e:
        print(f"\n[Error]: {e}")

if __name__ == "__main__":
    main()
