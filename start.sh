#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN="$ROOT/run"
mkdir -p "$RUN"

alive() { [[ -f "$1" ]] && kill -0 "$(cat "$1")" 2>/dev/null; }
if alive "$RUN/backend.pid" || alive "$RUN/frontend.pid"; then
  echo "Local Interviewer is already running. Use ./stop.sh first if you need a restart."
  exit 0
fi
command -v uv >/dev/null || { echo "uv is missing. Run ./setup.sh"; exit 1; }
[[ -d "$ROOT/frontend/node_modules" ]] || { echo "Frontend dependencies are missing. Run ./setup.sh"; exit 1; }

cd "$ROOT/backend"
LOCAL_INTERVIEWER_DATA_DIR="$ROOT/backend/data" nohup uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 >"$RUN/backend.log" 2>&1 &
echo $! > "$RUN/backend.pid"
cd "$ROOT/frontend"
nohup npm run dev -- --host 127.0.0.1 >"$RUN/frontend.log" 2>&1 &
echo $! > "$RUN/frontend.pid"
sleep 2
if ! alive "$RUN/backend.pid" || ! alive "$RUN/frontend.pid"; then
  echo "Startup failed. Inspect run/backend.log and run/frontend.log"
  "$ROOT/stop.sh" >/dev/null 2>&1 || true
  exit 1
fi
echo "Local Interviewer is running at http://127.0.0.1:5173"
echo "API documentation: http://127.0.0.1:8000/docs"
echo "Logs: $RUN"
