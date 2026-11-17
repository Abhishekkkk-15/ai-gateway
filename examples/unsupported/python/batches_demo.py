"""
AI Gateway Example: Asynchronous Batches API (POST /v1/batches)

Demonstrates submitting asynchronous batch jobs (up to 50% discount / high throughput)
using the official OpenAI Python SDK.

Usage:
    python examples/python/batches_demo.py
"""

import io
import json
import os
from openai import OpenAI

BASE_URL = os.environ.get("GATEWAY_BASE_URL", "http://localhost:3000/v1")
API_KEY = os.environ.get("GATEWAY_API_KEY", "sk-gw-test-key")

client = OpenAI(
    base_url=BASE_URL,
    api_key=API_KEY,
)

def main():
    print(f"[AI Gateway] Connecting to: {BASE_URL}")
    print("--- Asynchronous Batches API Demo ---\n")

    try:
        # 1. Prepare and upload batch input file
        print("1. Preparing and uploading batch request file (.jsonl)...")
        lines = [
            json.dumps({"custom_id": "request-task-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "groq/llama-3.3-70b-versatile", "messages": [{"role": "user", "content": "Summarize quantum computing in 10 words."}]}}),
            json.dumps({"custom_id": "request-task-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "groq/llama-3.3-70b-versatile", "messages": [{"role": "user", "content": "What is Moore's Law?"}]}}),
        ]
        content_bytes = ("\n".join(lines) + "\n").encode("utf-8")
        file_obj = io.BytesIO(content_bytes)
        file_obj.name = "batch_tasks.jsonl"

        batch_file = client.files.create(
            file=file_obj,
            purpose="batch",
        )
        print(f"[Success] Batch input file uploaded: {batch_file.id}")

        # 2. Submit batch
        print("\n2. Submitting batch job (24h completion window)...")
        batch = client.batches.create(
            input_file_id=batch_file.id,
            endpoint="/v1/chat/completions",
            completion_window="24h",
            metadata={"job_tag": "research_evaluation"},
        )

        print(f"[Success] Batch initiated: {batch.id}")
        print(f" • Status: {batch.status}")
        print(f" • Total Requests: {batch.request_counts.total}")

        # 3. Retrieve batch
        print(f"\n3. Checking batch status for {batch.id}...")
        status = client.batches.retrieve(batch.id)
        print(f" • Current Status: {status.status}")
        print(f" • Output File ID: {status.output_file_id}")

        if status.output_file_id:
            output = client.files.content(status.output_file_id)
            print(f"\n4. Batch Output Preview:\n{output.text}")

    except Exception as e:
        print(f"\n[Error]: {e}")

if __name__ == "__main__":
    main()
