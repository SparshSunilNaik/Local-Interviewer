import io
import json

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from app.models.entities import InterviewSession


def as_dict(session: InterviewSession) -> dict:
    evaluation = session.evaluation
    return {
        "schema_version": "1.0",
        "session": {
            "id": session.id,
            "type": session.interview_type,
            "difficulty": session.difficulty,
            "target_role": session.target_role,
            "status": session.status,
            "created_at": session.created_at.isoformat(),
            "overall_score": session.overall_score,
        },
        "evaluation": None if not evaluation else {
            "summary": evaluation.summary,
            "strengths": evaluation.strengths,
            "improvements": evaluation.improvements,
            "dimensions": evaluation.dimensions,
            "confidence": evaluation.confidence,
        },
        "transcript": [{"role": turn.role, "content": turn.content, "timestamp": turn.created_at.isoformat()} for turn in session.turns],
        "disclaimer": "AI-generated practice feedback; not a validated hiring decision.",
    }


def markdown(session: InterviewSession) -> str:
    data = as_dict(session)
    lines = ["# Local Interviewer Report", "", f"**Role:** {session.target_role or 'Not specified'}", f"**Interview:** {session.interview_type} · {session.difficulty}", f"**Status:** {session.status}"]
    if session.overall_score is not None:
        lines.append(f"**Practice score:** {session.overall_score:.1f}/100")
    lines.extend(["", "> AI-generated practice feedback; not a validated hiring decision.", ""])
    if data["evaluation"]:
        report = data["evaluation"]
        lines.extend(["## Summary", report["summary"], "", "## Strengths"])
        lines.extend(f"- {item}" for item in report["strengths"])
        lines.extend(["", "## Improvements"])
        lines.extend(f"- {item}" for item in report["improvements"])
    lines.extend(["", "## Transcript"])
    for turn in session.turns:
        lines.extend(["", f"**{'Astra' if turn.role == 'assistant' else 'Candidate'}:** {turn.content}"])
    return "\n".join(lines)


def json_bytes(session: InterviewSession) -> bytes:
    return json.dumps(as_dict(session), indent=2).encode()


def pdf(session: InterviewSession) -> bytes:
    buffer = io.BytesIO()
    styles = getSampleStyleSheet()
    document = SimpleDocTemplate(buffer, pagesize=letter, title="Local Interviewer Report")
    story = [Paragraph("Local Interviewer Report", styles["Title"]), Spacer(1, 12)]
    for line in markdown(session).splitlines():
        clean = line.lstrip("#>- ").strip()
        if clean:
            story.extend([Paragraph(clean.replace("**", ""), styles["BodyText"]), Spacer(1, 6)])
    document.build(story)
    return buffer.getvalue()
