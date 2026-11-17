"""
AI Gateway Example: Files & Resumable Uploads (POST /v1/files, GET, DELETE)

Demonstrates managing persistent files and datasets using the official OpenAI Python SDK.
Supports file uploads, list inspection, content streaming, and deletions.

Usage:
    python examples/python/files_demo.py
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
    print("--- Persistent Files API Demo ---\n")

    try:
        # 1. Upload dataset
        print("1. Uploading fine-tuning dataset...")
        lines = [
            json.dumps({"messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "What is AI Gateway?"}, {"role": "assistant", "content": "AI Gateway is a lightning-fast OpenAI-compatible proxy."}]}),
            json.dumps({"messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "Explain Zero-DB routing."}, {"role": "assistant", "content": "Zero-DB routing resolves providers and models directly in RAM in under 1 millisecond."}]}),
        ]
        content_bytes = ("\n".join(lines) + "\n").encode("utf-8")
        file_obj = io.BytesIO(content_bytes)
        file_obj.name = "sample_dataset.jsonl"

        uploaded_file = client.files.create(
            file=file_obj,
            purpose="fine-tune",
        )

        print(f"[Success] Uploaded file: {uploaded_file.id} ({uploaded_file.filename}, {uploaded_file.bytes} bytes)")

        # 2. List files
        print("\n2. Listing available files...")
        file_list = client.files.list()
        print(f"Total files in gateway storage: {len(file_list.data)}")
        for f in file_list.data[:5]:
            print(f" • [{f.id}] {f.filename} ({f.bytes} bytes, purpose: {f.purpose}, status: {f.status})")

        # 3. Retrieve content
        print(f"\n3. Downloading content for: {uploaded_file.id}...")
        content_response = client.files.content(uploaded_file.id)
        print(f"Downloaded content preview:\n{content_response.text}")

        # 4. Delete file
        print(f"\n4. Cleaning up file: {uploaded_file.id}...")
        del_result = client.files.delete(uploaded_file.id)
        print(f"[Success] File deleted: {del_result.id} (deleted: {del_result.deleted})")

    except Exception as e:
        print(f"\n[Error]: {e}")

if __name__ == "__main__":
    main()
