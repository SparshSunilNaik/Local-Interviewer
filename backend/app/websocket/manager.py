from datetime import UTC, datetime
from uuid import uuid4

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, set[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections.setdefault(session_id, set()).add(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket) -> None:
        self.connections.get(session_id, set()).discard(websocket)

    async def emit(self, session_id: str, event_type: str, payload: dict) -> None:
        envelope = {
            "protocol_version": "1.0",
            "session_id": session_id,
            "message_id": str(uuid4()),
            "event_type": event_type,
            "timestamp": datetime.now(UTC).isoformat(),
            "payload": payload,
        }
        stale = []
        for connection in self.connections.get(session_id, set()):
            try:
                await connection.send_json(envelope)
            except RuntimeError:
                stale.append(connection)
        for connection in stale:
            self.disconnect(session_id, connection)


manager = ConnectionManager()
