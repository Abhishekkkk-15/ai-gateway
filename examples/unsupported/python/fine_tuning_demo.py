"""
AI Gateway Example: Fine-Tuning API (/v1/fine_tuning/jobs)

Demonstrates creating and managing model customization fine-tuning jobs
using the official OpenAI Python SDK.

Usage:
    python examples/python/fine_tuning_demo.py
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
    print("--- Fine-Tuning API Demo ---\n")

    try:
        # 1. Upload training file
        print("1. Uploading training dataset for fine-tuning...")
        lines = [
            json.dumps({"messages": [{"role": "system", "content": "You speak in iambic pentameter."}, {"role": "user", "content": "Hello"}, {"role": "assistant", "content": "A fair good morrow unto thee, fair friend."}]}),
            json.dumps({"messages": [{"role": "system", "content": "You speak in iambic pentameter."}, {"role": "user", "content": "How are you?"}, {"role": "assistant", "content": "I stand in health and joyful in the sun."}]}),
        ]
        content = ("\n".join(lines) + "\n").encode("utf-8")
        file_obj = io.BytesIO(content)
        file_obj.name = "pentameter.jsonl"

        file = client.files.create(
            file=file_obj,
            purpose="fine-tune",
        )
        print(f"[Success] Training file uploaded: {file.id}")

        # 2. Create fine-tuning job
        print("\n2. Creating fine-tuning job...")
        job = client.fine_tuning.jobs.create(
            training_file=file.id,
            model="gpt-4o-mini-2024-07-18",
            hyperparameters={"n_epochs": 3},
        )
        print(f"[Success] Fine-Tuning Job Created: {job.id}")
        print(f" • Status: {job.status}")
        print(f" • Base Model: {job.model}")

        # 3. List jobs
        print("\n3. Listing all fine-tuning jobs...")
        jobs = client.fine_tuning.jobs.list()
        print(f"Total jobs: {len(jobs.data)}")
        for j in jobs.data[:5]:
            print(f" • [{j.id}] {j.model} -> status: {j.status}")

        # 4. Cancel job
        print(f"\n4. Cancelling fine-tuning job: {job.id}...")
        cancelled = client.fine_tuning.jobs.cancel(job.id)
        print(f"[Success] Job cancelled: {cancelled.id} (status: {cancelled.status})")

    except Exception as e:
        print(f"\n[Error]: {e}")

if __name__ == "__main__":
    main()
