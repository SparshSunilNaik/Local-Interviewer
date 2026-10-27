from dataclasses import dataclass


class InvalidTransition(ValueError):
    pass


TRANSITIONS = {
    "IDLE": {"PREPARING"},
    "PREPARING": {"READY", "FAILED"},
    "READY": {"INTRODUCING", "FAILED"},
    "INTRODUCING": {"SPEAKING", "LISTENING", "FAILED"},
    "ASKING": {"SPEAKING", "LISTENING", "FAILED"},
    "SPEAKING": {"LISTENING", "PAUSED", "FAILED"},
    "LISTENING": {"TRANSCRIBING", "THINKING", "PAUSED", "ENDING", "FAILED"},
    "TRANSCRIBING": {"LISTENING", "THINKING", "FAILED"},
    "THINKING": {"ASKING", "ENDING", "RECOVERING", "FAILED"},
    "RECOVERING": {"THINKING", "ASKING", "LISTENING", "ENDING", "FAILED"},
    "PAUSED": {"LISTENING", "SPEAKING", "ENDING", "FAILED"},
    "ENDING": {"EVALUATING", "COMPLETED", "FAILED"},
    "EVALUATING": {"COMPLETED", "FAILED"},
    "FAILED": {"RECOVERING", "ENDING"},
    "COMPLETED": set(),
}


@dataclass
class StateMachine:
    state: str

    def transition(self, target: str) -> str:
        if target not in TRANSITIONS.get(self.state, set()):
            raise InvalidTransition(f"Cannot transition from {self.state} to {target}")
        self.state = target
        return target
