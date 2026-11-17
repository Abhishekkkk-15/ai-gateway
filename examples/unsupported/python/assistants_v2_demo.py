"""
AI Gateway Example: Assistants v2 & Stateful Agent Engine (/v1/assistants, /v1/threads, /v1/runs)

Demonstrates creating stateful AI assistants, managing threads and messages,
and triggering runs using the official OpenAI Python SDK.

Usage:
    python examples/python/assistants_v2_demo.py
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
    print("--- Assistants v2 Agent Demo ---\n")

    try:
        # 1. Create Assistant
        print("1. Creating autonomous assistant...")
        assistant = client.beta.assistants.create(
            model=MODEL,
            name="DevOps & Gateway Specialist",
            instructions="You are an expert engineer. Always provide precise code snippets and architectures.",
            tools=[{"type": "code_interpreter"}],
        )
        print(f"[Success] Assistant Created: {assistant.id} ({assistant.name})")

        # 2. Create Thread
        print("\n2. Creating conversation thread...")
        thread = client.beta.threads.create(
            metadata={"session_type": "devops_consultation"}
        )
        print(f"[Success] Thread Created: {thread.id}")

        # 3. Post Message
        print("\n3. Posting user message to thread...")
        user_message = client.beta.threads.messages.create(
            thread_id=thread.id,
            role="user",
            content="How should I configure CORS for a Fastify AI Gateway handling SSE streaming?",
        )
        print(f"[Success] User Message Added: {user_message.id}")

        # 4. Execute Run
        print("\n4. Executing assistant run...")
        run = client.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id=assistant.id,
            instructions="Give a 2-step setup answer with TypeScript code.",
        )
        print(f"[Success] Run Completed: {run.id} (status: {run.status})")

        # 5. List Messages
        print("\n5. Retrieving updated thread messages...")
        messages = client.beta.threads.messages.list(thread_id=thread.id)
        print(f"Total messages in thread: {len(messages.data)}")
        for msg in messages.data:
            text_val = msg.content[0].text.value if msg.content else ""
            print(f" • [{msg.role.upper()}]: {text_val[:100]}...")

        # 6. Cleanup
        print(f"\n6. Cleaning up assistant: {assistant.id}...")
        client.beta.assistants.delete(assistant.id)
        client.beta.threads.delete(thread.id)
        print("[Success] Assistant and Thread cleaned up.")

    except Exception as e:
        print(f"\n[Error]: {e}")

if __name__ == "__main__":
    main()
