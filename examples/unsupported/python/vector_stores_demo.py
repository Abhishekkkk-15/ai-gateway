"""
AI Gateway Example: Vector Stores API (/v1/vector_stores)

Demonstrates managing vector stores, attaching knowledge files, and managing
file batches using the official OpenAI Python SDK.

Usage:
    python examples/python/vector_stores_demo.py
"""

import io
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
    print("--- Vector Stores API Demo ---\n")

    try:
        # 1. Upload file
        print("1. Uploading documentation file...")
        doc_content = (
            "Antigravity AI Gateway Architecture:\n"
            "- In-Memory Zero-DB routing resolution under 1ms\n"
            "- Modular Provider Adapters (Groq, Nvidia, ElevenLabs, OpenAI)\n"
            "- Integrated Streaming Telemetry Queue\n"
        ).encode("utf-8")
        file_obj = io.BytesIO(doc_content)
        file_obj.name = "gateway_arch.txt"

        file = client.files.create(
            file=file_obj,
            purpose="assistants",
        )
        print(f"[Success] Uploaded document file: {file.id}")

        # 2. Create vector store
        print("\n2. Creating vector store and indexing file...")
        store = client.vector_stores.create(
            name="Gateway Engineering Knowledge Base",
            file_ids=[file.id],
            metadata={"department": "platform_infra"},
        )
        print(f"[Success] Vector store created: {store.id}")
        print(f" • Name: {store.name}")
        print(f" • Files Indexed: {store.file_counts.total}")

        # 3. List vector stores
        print("\n3. Listing available vector stores...")
        stores = client.vector_stores.list()
        print(f"Total vector stores: {len(stores.data)}")
        for s in stores.data:
            print(f" • [{s.id}] {s.name} ({s.file_counts.total} files, status: {s.status})")

        # 4. Clean up
        print(f"\n4. Cleaning up vector store: {store.id}...")
        del_store = client.vector_stores.delete(store.id)
        print(f"[Success] Deleted vector store: {del_store.id} (deleted: {del_store.deleted})")

        client.files.delete(file.id)
        print(f"[Success] Deleted backing file: {file.id}")

    except Exception as e:
        print(f"\n[Error]: {e}")

if __name__ == "__main__":
    main()
