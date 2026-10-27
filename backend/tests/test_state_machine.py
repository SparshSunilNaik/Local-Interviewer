import pytest

from app.services.interview.state_machine import InvalidTransition, StateMachine


def test_valid_interview_lifecycle():
    machine = StateMachine("IDLE")
    for state in ("PREPARING", "READY", "INTRODUCING", "SPEAKING", "LISTENING", "THINKING", "ENDING", "COMPLETED"):
        machine.transition(state)
    assert machine.state == "COMPLETED"


def test_invalid_transition_is_rejected():
    with pytest.raises(InvalidTransition):
        StateMachine("LISTENING").transition("COMPLETED")
