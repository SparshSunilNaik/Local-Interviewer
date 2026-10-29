from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def test_structured_memory_persists_across_answer_requests():
    first_id, second_id = str(uuid4()), str(uuid4())
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/interviews",
            json={
                "interview_type": "Python",
                "difficulty": "Intermediate",
                "duration_minutes": 15,
                "target_role": "Python Engineer",
                "mode": "text",
            },
        ).json()
        session_id = created["id"]
        for message_id, answer in (
            (first_id, "I use FastAPI with explicit service boundaries and measured latency."),
            (second_id, "I use PostgreSQL transactions and monitor connection pool wait time."),
        ):
            response = client.post(
                f"/api/v1/interviews/{session_id}/answers",
                json={"content": answer, "message_id": message_id},
            )
            assert response.status_code == 200
        persisted = client.get(f"/api/v1/interviews/{session_id}").json()
        client.delete(f"/api/v1/interviews/{session_id}")
    assert persisted["memory"]["message_ids"] == [first_id, second_id]
    assert len(persisted["memory"]["questions_asked"]) == 3
    assert len(persisted["memory"]["covered_topics"]) == 3
