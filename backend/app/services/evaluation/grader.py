import json
from collections import Counter

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Evaluation, InterviewSession, ProviderProfile
from app.services.llm.ollama import OllamaClient


class Dimension(BaseModel):
    dimension: str
    score: float = Field(ge=0, le=100)
    weight: float = Field(gt=0, le=1)
    explanation: str
    evidence: list[str] = Field(max_length=3)
    confidence: float = Field(ge=0, le=1)
    suggested_improvement: str


class EvaluationResult(BaseModel):
    overall_score: float = Field(ge=0, le=100)
    summary: str
    strengths: list[str]
    improvements: list[str]
    suggested_questions: list[str]
    dimensions: list[Dimension]
    confidence: float = Field(ge=0, le=1)


EVALUATION_SYSTEM = """You are an evidence-bound interview evaluator. Return JSON only matching:
{"overall_score":0-100,"summary":"...","strengths":[],"improvements":[],
"suggested_questions":[],"dimensions":[{"dimension":"...","score":0-100,"weight":0-1,
"explanation":"...","evidence":["exact brief excerpt"],"confidence":0-1,
"suggested_improvement":"..."}],"confidence":0-1}.
Use only candidate statements as evidence. Say insufficient evidence rather than assuming. Never infer or
score accent, name, gender, nationality, disability, or any protected trait. Weights must total 1."""


class Grader:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def grade(self, session: InterviewSession) -> Evaluation:
        candidate_answers = [turn.content for turn in session.turns if turn.role == "candidate"]
        if not candidate_answers:
            raise ValueError("At least one candidate answer is required for evaluation")
        result = await self._model_grade(session, candidate_answers)
        evaluation = session.evaluation or Evaluation(session_id=session.id)
        for key, value in result.model_dump().items():
            if key == "dimensions":
                value = [item.model_dump() for item in result.dimensions]
            setattr(evaluation, key, value)
        session.overall_score = result.overall_score
        session.status = "COMPLETED"
        self.db.add(evaluation)
        await self.db.commit()
        await self.db.refresh(evaluation)
        return evaluation

    async def _model_grade(self, session: InterviewSession, answers: list[str]) -> EvaluationResult:
        profile = await self.db.get(ProviderProfile, session.provider_id) if session.provider_id else None
        if profile:
            transcript = "\n".join(
                f"{turn.role.upper()}: {turn.content}" for turn in session.turns
            )[-24_000:]
            prompt = f"Role: {session.target_role}; type: {session.interview_type}; difficulty: {session.difficulty}\n{transcript}"
            for _attempt in range(2):
                try:
                    response = await OllamaClient(profile).chat(
                        [{"role": "system", "content": EVALUATION_SYSTEM}, {"role": "user", "content": prompt}],
                        structured=True,
                    )
                    result = EvaluationResult.model_validate_json(response["content"])
                    return self._enforce_evidence(self._normalize_weights(result), answers)
                except (ValidationError, ValueError, RuntimeError, json.JSONDecodeError):
                    continue
        return self._deterministic_grade(answers)

    @staticmethod
    def _normalize_weights(result: EvaluationResult) -> EvaluationResult:
        total = sum(item.weight for item in result.dimensions)
        if not result.dimensions or total <= 0:
            raise ValueError("Evaluation has no weighted dimensions")
        for item in result.dimensions:
            item.weight = item.weight / total
        result.overall_score = round(sum(item.score * item.weight for item in result.dimensions), 1)
        return result

    @staticmethod
    def _enforce_evidence(result: EvaluationResult, answers: list[str]) -> EvaluationResult:
        """Evidence must be a verbatim candidate excerpt, never an interviewer statement."""
        normalized_answers = [" ".join(answer.split()).casefold() for answer in answers]
        for dimension in result.dimensions:
            dimension.evidence = [
                quote
                for quote in dimension.evidence
                if any(" ".join(quote.split()).casefold() in answer for answer in normalized_answers)
            ]
            if not dimension.evidence:
                dimension.confidence = min(dimension.confidence, 0.3)
                dimension.explanation = f"Insufficient direct evidence. {dimension.explanation}"
        result.confidence = min(
            result.confidence,
            sum(dimension.confidence for dimension in result.dimensions) / len(result.dimensions),
        )
        return result

    @staticmethod
    def _deterministic_grade(answers: list[str]) -> EvaluationResult:
        words = [answer.split() for answer in answers]
        average = sum(map(len, words)) / len(words)
        evidence_score = min(80, 40 + average * 0.6)
        clarity_score = min(80, 45 + min(average, 50) * 0.5)
        repeated = Counter(word.lower().strip(".,") for answer in words for word in answer)
        evidence = [answer[:180] for answer in answers[:2]]
        dimensions = [
            Dimension(dimension="Depth of explanation", score=evidence_score, weight=0.5, explanation="Based on the specificity and development of the submitted answers.", evidence=evidence, confidence=0.45, suggested_improvement="Use a concrete example with decisions, trade-offs, and a measured outcome."),
            Dimension(dimension="Communication clarity", score=clarity_score, weight=0.5, explanation="Based on answer structure and completeness; content was not fact-checked.", evidence=evidence, confidence=0.4, suggested_improvement="Lead with the conclusion, then support it with concise evidence."),
        ]
        return EvaluationResult(
            overall_score=round((evidence_score + clarity_score) / 2, 1),
            summary="Limited local fallback assessment. Connect an Ollama profile for deeper technical evaluation.",
            strengths=["Completed the interview with substantive answers"] if average >= 20 else [],
            improvements=["Add concrete evidence and explicit trade-offs"],
            suggested_questions=["Describe a failure, its root cause, and what changed afterward."],
            dimensions=dimensions,
            confidence=0.4 if repeated else 0.3,
        )
