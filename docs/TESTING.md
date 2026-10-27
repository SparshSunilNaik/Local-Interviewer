# Testing

## Automated

Backend tests cover health, URL rejection, thinking removal, special-address blocking, state transitions, empty audio, document formats, fallback scoring, and candidate-only evidence. Frontend tests cover accessible Astra state and API error propagation. Playwright covers onboarding, interview creation, text answers, pause/resume, ending, evaluation, exports, history persistence, deletion, and provider failure.

```bash
cd backend && uv run ruff check . && uv run pytest
cd ../frontend && npm run lint && npm test && npm run build && npm run test:e2e
```

CI repeats these with Python 3.12, Node 22, and Chromium. E2E uses the deterministic offline bank and a deliberately unreachable provider, so results do not depend on Ollama.

## Hardware and live models

Browser mocks or HTTP tests are not proof of physical audio. Record separately whether microphone capture, speakers, recorded-sample STT, live Ollama, and TTS have actually run. Never mark a hardware row passed based only on device enumeration.

The development validation machine produced a real WAV with macOS TTS and completed a live qwen3:8b adaptive question and structured evaluation. Physical microphone capture, audible speaker confirmation, and Whisper model transcription remained manual/unverified at delivery time.
