from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.entities import InterviewSession, ProviderProfile
from app.schemas.interview import AnswerCreate, InterviewCreate, InterviewRead
from app.services.interview.engine import InterviewEngine

router = APIRouter(prefix="/interviews", tags=["interviews"])
Database = Annotated[AsyncSession, Depends(get_db)]


async def load_session(session_id: str, db: AsyncSession) -> InterviewSession:
    query = (
        select(InterviewSession)
        .where(InterviewSession.id == session_id)
        .options(selectinload(InterviewSession.turns), selectinload(InterviewSession.evaluation))
    )
    session = (await db.scalars(query)).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview not found")
    return session


@router.get("/templates")
async def templates():
    from app.services.interview.questions import CATEGORIES

    return {
        "types": CATEGORIES,
        "difficulties": ["Beginner", "Intermediate", "Advanced", "Expert"],
        "durations": [10, 15, 30, 45, 60],
    }


@router.post("", response_model=InterviewRead, status_code=status.HTTP_201_CREATED)
async def create_interview(payload: InterviewCreate, db: Database):
    if payload.provider_id and not await db.get(ProviderProfile, payload.provider_id):
        raise HTTPException(status_code=400, detail="Selected provider does not exist")
    now = datetime.now(UTC)
    session = InterviewSession(
        status="PREPARING",
        interview_type=payload.interview_type,
        difficulty=payload.difficulty,
        duration_minutes=payload.duration_minutes,
        target_role=payload.target_role,
        custom_instructions=payload.custom_instructions,
        mode=payload.mode,
        provider_id=payload.provider_id,
        started_at=now,
        config_snapshot=payload.model_dump(exclude={"resume_text", "job_description"}),
        memory={
            "candidate_profile": payload.resume_text[:12_000],
            "job_description": payload.job_description[:12_000],
            "record_audio": payload.record_audio,
        },
    )
    db.add(session)
    await db.flush()
    await InterviewEngine(db).start(session)
    return await load_session(session.id, db)


@router.get("", response_model=list[InterviewRead])
async def history(
    db: Database, limit: Annotated[int, Query(ge=1, le=100)] = 30, offset: Annotated[int, Query(ge=0)] = 0
):
    query = (
        select(InterviewSession)
        .options(selectinload(InterviewSession.turns), selectinload(InterviewSession.evaluation))
        .order_by(InterviewSession.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return (await db.scalars(query)).all()


@router.get("/{session_id}", response_model=InterviewRead)
async def get_interview(session_id: str, db: Database):
    return await load_session(session_id, db)


@router.post("/{session_id}/answers", response_model=InterviewRead)
async def submit_answer(session_id: str, payload: AnswerCreate, db: Database):
    session = await load_session(session_id, db)
    if session.status not in {"LISTENING", "RECOVERING", "ENDING"}:
        raise HTTPException(status_code=409, detail=f"Cannot answer while session is {session.status}")
    await InterviewEngine(db).accept_answer(session, payload.content.strip(), payload.message_id)
    return await load_session(session_id, db)


@router.post("/{session_id}/pause", response_model=InterviewRead)
async def pause(session_id: str, db: Database):
    session = await load_session(session_id, db)
    if session.status not in {"LISTENING", "SPEAKING"}:
        raise HTTPException(status_code=409, detail="Interview cannot be paused in its current state")
    session.status = "PAUSED"
    await db.commit()
    return await load_session(session_id, db)


@router.post("/{session_id}/resume", response_model=InterviewRead)
async def resume(session_id: str, db: Database):
    session = await load_session(session_id, db)
    if session.status != "PAUSED":
        raise HTTPException(status_code=409, detail="Interview is not paused")
    session.status = "LISTENING"
    await db.commit()
    return await load_session(session_id, db)


@router.post("/{session_id}/end", response_model=InterviewRead)
async def end(session_id: str, db: Database):
    session = await load_session(session_id, db)
    if session.status == "COMPLETED":
        return session
    session.status = "ENDING"
    session.phase = "evaluation"
    session.ended_at = datetime.now(UTC)
    await db.commit()
    return await load_session(session_id, db)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interview(session_id: str, db: Database):
    session = await load_session(session_id, db)
    await db.delete(session)
    await db.commit()
