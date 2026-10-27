# Architecture

## Boundaries

The browser never contacts Ollama, loads model weights, or performs cloud speech. It captures a bounded utterance with `MediaRecorder`, displays live input energy, and sends the browser-reported MIME type to FastAPI. FastAPI is the trust boundary and remains loopback-bound by default.

`backend/app/services/interview` surrounds model output with deterministic state, memory, duplicate-message protection, bounded follow-ups, phase selection, and fallback questions. Model text cannot execute code. `services/llm` is the only Ollama transport. `services/audio`, `documents`, `evaluation`, and `reports` are independent adapters.

SQLite uses WAL, foreign keys, and a busy timeout. Sessions own turns and evaluations with cascade deletion. Alembic contains the schema baseline; startup also creates absent tables for a friendly first run.

## Runtime flow

1. React creates an interview configuration snapshot.
2. FastAPI persists the session and Astra's opening question.
3. Candidate text or confirmed local STT is submitted with a unique message ID.
4. The engine rejects duplicates, updates memory, requests a typed action, or selects a fallback.
5. The frontend reads backend-authoritative state and optionally requests local TTS.
6. Ending preserves the transcript even if evaluation fails; evaluation can be retried.

WebSocket envelopes carry protocol version, session/message IDs, event type, timestamp, and payload. Mutating commands remain on validated HTTP endpoints; WebSocket accepts only ping in the initial release.

## Data and privacy

Database and optional artifacts live under `backend/data/` and are git-ignored. Raw microphone data is temporary unless future recording persistence is explicitly enabled. Export is performed locally.
