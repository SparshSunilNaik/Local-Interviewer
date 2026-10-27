from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.interviews import load_session
from app.db.session import get_db
from app.schemas.interview import EvaluationRead
from app.services.evaluation.grader import Grader
from app.services.reports import exporter

router = APIRouter(tags=["evaluation", "reports"])
Database = Annotated[AsyncSession, Depends(get_db)]


@router.post("/interviews/{session_id}/evaluation", response_model=EvaluationRead)
async def evaluate(session_id: str, db: Database):
    session = await load_session(session_id, db)
    session.status = "EVALUATING"
    try:
        return await Grader(db).grade(session)
    except ValueError as exc:
        session.status = "ENDING"
        await db.commit()
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/interviews/{session_id}/export/{format}")
async def export(session_id: str, format: Literal["markdown", "json", "pdf"], db: Database):
    session = await load_session(session_id, db)
    content_types = {"markdown": "text/markdown", "json": "application/json", "pdf": "application/pdf"}
    extensions = {"markdown": "md", "json": "json", "pdf": "pdf"}
    data = {"markdown": lambda: exporter.markdown(session).encode(), "json": lambda: exporter.json_bytes(session), "pdf": lambda: exporter.pdf(session)}[format]()
    return Response(data, media_type=content_types[format], headers={"Content-Disposition": f'attachment; filename="interview-{session.id}.{extensions[format]}"'})
