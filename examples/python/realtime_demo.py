"""
AI Gateway Example: Realtime API Bidirectional WebSocket Bridge (/v1/realtime)

Demonstrates connecting to the ultra-low-latency bidirectional Realtime API
using standard Python WebSockets (or websocket-client).

Usage:
    python examples/python/realtime_demo.py
"""

import os
import json
import asyncio
try:
    import websockets
except ImportError:
    websockets = None

BASE_URL = os.environ.get("GATEWAY_BASE_URL", "http://localhost:3000/v1")
API_KEY = os.environ.get("GATEWAY_API_KEY", "sk-gw-test-key")
MODEL = os.environ.get("GATEWAY_REALTIME_MODEL", "gpt-4o-realtime-preview")

WS_URL = BASE_URL.replace("http://", "ws://").replace("https://", "wss://") + f"/realtime?model={MODEL}"

async def main():
    if not websockets:
        print("[Notice]: Install websockets with `pip install websockets` to run this script.")
        return

    print(f"[AI Gateway] Connecting to Realtime WebSocket: {WS_URL}")
    print("--- Realtime API Bidirectional WebSocket Demo ---\n")

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "OpenAI-Beta": "realtime=v1",
    }

    async with websockets.connect(WS_URL, extra_headers=headers) as ws:
        print("[Connected] WebSocket handshake established.")

        # 1. Send session.update
        print("\n1. Sending session.update event...")
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "modalities": ["text"],
                "instructions": "You are an ultra-fast streaming assistant.",
            }
        }))

        async for message in ws:
            event = json.loads(message)
            print(f" ← Received event: \"{event.get('type')}\"")

            if event.get("type") == "session.updated":
                print("\n2. Triggering assistant response turn (response.create)...")
                await ws.send(json.dumps({
                    "type": "response.create",
                    "response": {
                        "modalities": ["text"],
                        "instructions": "Say: Realtime bidirectional WebSocket bridge verified.",
                    }
                }))

            if event.get("type") == "response.done":
                print("\n[Success] Response turn finished! Closing connection.")
                break

if __name__ == "__main__":
    if websockets:
        asyncio.run(main())
    else:
        print("Please install websockets (`pip install websockets`).")
