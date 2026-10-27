from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.db.session import SessionLocal
from app.models.entities import InterviewSession
from app.websocket.manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{session_id}")
async def session_socket(websocket: WebSocket, session_id: str):
    async with SessionLocal() as db:
        if not await db.get(InterviewSession, session_id):
            await websocket.close(code=4404, reason="Interview not found")
            return
    await manager.connect(session_id, websocket)
    await manager.emit(session_id, "session.ready", {"connected": True})
    try:
        while True:
            message = await websocket.receive_json()
            # The socket is event transport, not a generic command interface.
            if message.get("event_type") == "session.ping":
                await manager.emit(session_id, "session.pong", {})
            else:
                await manager.emit(session_id, "session.error", {"message": "Unsupported event"})
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)
