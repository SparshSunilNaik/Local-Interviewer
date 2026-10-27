from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models import entities  # noqa: F401


@asynccontextmanager
async def lifespan(_app: FastAPI):
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(title="Local Interviewer API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["*"] ,
    allow_headers=["*"] ,
)


@app.get("/api/v1/health")
async def health() -> dict:
    return {"status": "ok", "service": "local-interviewer", "version": app.version}
