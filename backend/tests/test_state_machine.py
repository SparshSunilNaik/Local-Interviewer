import pytest

from app.services.interview.engine import InterviewEngine
from app.services.interview.quality import assess_follow_up
from app.services.interview.state_machine import InvalidTransition, StateMachine


def test_valid_interview_lifecycle():
    machine = StateMachine("IDLE")
    for state in ("PREPARING", "READY", "INTRODUCING", "SPEAKING", "LISTENING", "THINKING", "ENDING", "COMPLETED"):
        machine.transition(state)
    assert machine.state == "COMPLETED"


def test_invalid_transition_is_rejected():
    with pytest.raises(InvalidTransition):
        StateMachine("LISTENING").transition("COMPLETED")


def test_microphone_test_is_not_treated_as_interview_content():
    action = InterviewEngine._recovery_action("Hello 123123 microphone testing.")
    assert action is not None
    assert action.action == "clarify"
    assert "microphone test" in action.question


def test_gil_misconception_is_challenged_without_revealing_answer():
    action = InterviewEngine._recovery_action(
        "Python's GIL makes all Python code run in parallel across CPU cores using threads."
    )
    assert action is not None
    assert "test that claim" in action.question
    assert "only one thread" not in action.question.lower()


def test_uncertainty_is_reframed_as_simpler_scenario():
    action = InterviewEngine._recovery_action("I'm not sure how database indexing works.")
    assert action is not None
    assert "table grows" in action.question


def test_generic_uncertainty_does_not_invent_a_database_topic():
    action = InterviewEngine._recovery_action("I'm not sure how that works.")
    assert action is not None
    assert "database" not in action.question.lower()
    assert "simpler angle" in action.question.lower()


def test_follow_up_quality_rubric_flags_repetition_and_praise():
    question = "Excellent. How did Redis caching affect latency?"
    result = assess_follow_up(
        "Redis caching reduced latency.", question, [question]
    )
    assert result["lexically_grounded"] is True
    assert "generic_praise" in result["failures"]
    assert "near_duplicate_question" in result["failures"]
