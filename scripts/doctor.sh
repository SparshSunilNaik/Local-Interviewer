#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fail=0
check() { if command -v "$1" >/dev/null; then echo "✓ $1: $($1 --version 2>&1 | head -n1)"; else echo "✗ $1 missing"; fail=1; fi; }
echo "Local Interviewer doctor"
echo "OS: $(uname -s) $(uname -m)"
check git
check uv
check node
check npm
check ffmpeg
if command -v ollama >/dev/null; then
  echo "✓ ollama: $(ollama --version 2>&1)"
  if curl -fsS --max-time 2 http://127.0.0.1:11434/api/version >/dev/null; then
    echo "✓ local Ollama is responding"
    ollama list
  else echo "! Ollama installed but local server is not responding"; fi
else echo "! Ollama not installed (optional until model-backed interviews)"; fi
if [[ -x "$ROOT/backend/.venv/bin/python" ]]; then echo "✓ backend environment: $($ROOT/backend/.venv/bin/python --version)"; else echo "✗ backend environment missing; run ./setup.sh"; fail=1; fi
[[ -d "$ROOT/frontend/node_modules" ]] && echo "✓ frontend dependencies installed" || { echo "✗ frontend dependencies missing"; fail=1; }
exit "$fail"
