# Interview Engine

The engine is not an unrestricted chatbot. Valid states are `IDLE`, `PREPARING`, `READY`, `INTRODUCING`, `ASKING`, `SPEAKING`, `LISTENING`, `TRANSCRIBING`, `THINKING`, `PAUSED`, `RECOVERING`, `ENDING`, `EVALUATING`, `COMPLETED`, and `FAILED`; invalid transitions are rejected.

Structured memory tracks topics, questions, duplicate message IDs, strengths, gaps, phase, bank position, candidate/job context, and follow-up count. Context sent to Ollama is bounded. Uploaded text is labeled untrusted and cannot override system instructions.

Qwen returns a typed action (`ask`, `clarify`, `transition`, or `end`). Pydantic validates it with two bounded attempts. Hidden `thinking` fields and `<think>` blocks are discarded. If inference fails, every supported category has deterministic questions and a bounded clarification rule. One question is asked per turn.

Short interviews use fewer core questions; longer sessions progress from warm-up to background, core depth, scenario work, candidate questions, and closing. The initial release uses reliable half-duplex interaction and does not implement barge-in.
