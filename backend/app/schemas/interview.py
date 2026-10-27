from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

InterviewState = Literal[
    "IDLE", "PREPARING", "READY", "INTRODUCING", "ASKING", "SPEAKING", "LISTENING",
    "TRANSCRIBING", "THINKING", "PAUSED", "RECOVERING", "ENDING", "EVALUATING",
    "COMPLETED", "FAILED",
]


class InterviewCreate(BaseModel):
    interview_type: str = Field(min_length=1, max_length=100)
    difficulty: Literal["Beginner", "Intermediate", "Advanced", "Expert"]
    duration_minutes: int = Field(ge=5, le=180)
    target_role: str = Field(default="", max_length=200)
    custom_instructions: str = Field(default="", max_length=4000)
    mode: Literal["text", "push-to-talk", "automatic"] = "text"
    provider_id: str | None = None
    resume_text: str = Field(default="", max_length=100_000)
    job_description: str = Field(default="", max_length=100_000)
    record_audio: bool = False


class TurnRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    sequence: int
    role: str
    content: str
    created_at: datetime
    metadata_json: dict


class EvaluationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    overall_score: float
    summary: str
    strengths: list
    improvements: list
    suggested_questions: list
    dimensions: list
    confidence: float


class InterviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    status: str
    interview_type: str
    difficulty: str
    duration_minutes: int
    target_role: str
    mode: str
    phase: str
    current_question: str
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime
    overall_score: float | None
    error: str | None
    memory: dict
    turns: list[TurnRead] = []
    evaluation: EvaluationRead | None = None


class AnswerCreate(BaseModel):
    content: str = Field(min_length=1, max_length=30_000)
    message_id: str = Field(min_length=8, max_length=100)
    stt_confidence: float | None = Field(default=None, ge=0, le=1)


class InterviewAction(BaseModel):
    action: Literal["ask", "clarify", "transition", "end"] = "ask"
    question: str = Field(min_length=3, max_length=1000)
    topic: str = Field(min_length=1, max_length=100)
    rationale: str = Field(default="", max_length=500)
    demonstrated_strengths: list[str] = Field(default_factory=list, max_length=5)
    knowledge_gaps: list[str] = Field(default_factory=list, max_length=5)
