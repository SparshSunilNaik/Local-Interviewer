# Windows Setup

Install Git, Node.js 22+, `uv`, FFmpeg (on `PATH`), and optionally Ollama. In PowerShell:

```powershell
git clone https://github.com/SparshSunilNaik/Local-Interviewer.git
cd Local-Interviewer
.\scripts\setup-windows.ps1
.\scripts\start-windows.ps1
```

Open `http://127.0.0.1:5173`. Install portable STT with `cd backend; uv sync --group stt-portable`. Faster Whisper runs locally and downloads the selected model only when requested. The macOS voice fallback is unavailable on Windows; configure a verified local Kokoro runtime before selecting voice mode, or use text-only mode.

PowerShell startup opens separate project-owned terminals. Close those terminals to stop the servers; it does not terminate unrelated Python, Node, or Ollama processes.
