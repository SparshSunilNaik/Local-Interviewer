from datetime import datetime

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDTimestampMixin


class ProviderProfile(UUIDTimestampMixin, Base):
    __tablename__ = "provider_profiles"
    name: Mapped[str] = mapped_column(String(100))
    base_url: Mapped[str] = mapped_column(String(500))
    model: Mapped[str] = mapped_column(String(200), default="qwen3:8b")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    temperature: Mapped[float] = mapped_column(Float, default=0.5)
    context_length: Mapped[int] = mapped_column(Integer, default=8192)
    max_tokens: Mapped[int] = mapped_column(Integer, default=512)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=120)
    retries: Mapped[int] = mapped_column(Integer, default=1)
    keep_alive: Mapped[str] = mapped_column(String(30), default="10m")
    thinking: Mapped[bool] = mapped_column(Boolean, default=False)


class AppSetting(UUIDTimestampMixin, Base):
    __tablename__ = "app_settings"
    key: Mapped[str] = mapped_column(String(100), unique=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)


class InterviewSession(UUIDTimestampMixin, Base):
    __tablename__ = "interview_sessions"
    status: Mapped[str] = mapped_column(String(30), default="PREPARING")
    interview_type: Mapped[str] = mapped_column(String(100))
    difficulty: Mapped[str] = mapped_column(String(30))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    target_role: Mapped[str] = mapped_column(String(200), default="")
    custom_instructions: Mapped[str] = mapped_column(Text, default="")
    mode: Mapped[str] = mapped_column(String(20), default="text")
    phase: Mapped[str] = mapped_column(String(50), default="greeting")
    provider_id: Mapped[str | None] = mapped_column(ForeignKey("provider_profiles.id"))
    config_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    memory: Mapped[dict] = mapped_column(JSON, default=dict)
    current_question: Mapped[str] = mapped_column(Text, default="")
    started_at: Mapped[datetime | None]
    ended_at: Mapped[datetime | None]
    error: Mapped[str | None] = mapped_column(Text)
    overall_score: Mapped[float | None] = mapped_column(Float)
    turns: Mapped[list["InterviewTurn"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="InterviewTurn.sequence"
    )
    evaluation: Mapped["Evaluation | None"] = relationship(
        back_populates="session", cascade="all, delete-orphan", uselist=False
    )


class InterviewTurn(UUIDTimestampMixin, Base):
    __tablename__ = "interview_turns"
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"))
    sequence: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    question_id: Mapped[str | None] = mapped_column(String(100))
    accepted: Mapped[bool] = mapped_column(Boolean, default=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    session: Mapped[InterviewSession] = relationship(back_populates="turns")


class Evaluation(UUIDTimestampMixin, Base):
    __tablename__ = "evaluations"
    session_id: Mapped[str] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), unique=True
    )
    overall_score: Mapped[float] = mapped_column(Float)
    summary: Mapped[str] = mapped_column(Text)
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    improvements: Mapped[list] = mapped_column(JSON, default=list)
    suggested_questions: Mapped[list] = mapped_column(JSON, default=list)
    dimensions: Mapped[list] = mapped_column(JSON, default=list)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    session: Mapped[InterviewSession] = relationship(back_populates="evaluation")
