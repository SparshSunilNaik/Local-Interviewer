#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Setting up Local Interviewer in $ROOT"
command -v uv >/dev/null || { echo "uv is required: https://docs.astral.sh/uv/"; exit 1; }
command -v npm >/dev/null || { echo "Node.js/npm is required."; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is required (macOS: brew install ffmpeg)."; exit 1; }
(cd "$ROOT/backend" && uv sync --group dev --group audio)
(cd "$ROOT/frontend" && npm install)
echo "Base setup complete. No model weights were downloaded."
echo "Apple Silicon STT (downloads packages, not model weights): cd backend && uv sync --group stt-apple"
echo "Kokoro MLX package (experimental compatibility): cd backend && uv sync --group tts-apple"
echo "Whisper and Ollama model downloads occur only when you explicitly request them."
echo "Run ./start.sh"
