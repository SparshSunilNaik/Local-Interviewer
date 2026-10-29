# macOS Setup

Apple Silicon with 16 GB or more is recommended. Install prerequisites:

```bash
brew install uv node ffmpeg libsndfile portaudio ollama
ollama serve
ollama pull qwen3:8b
./setup.sh
```

For MLX Whisper:

```bash
cd backend
uv sync --group stt-apple
```

The first `mlx-community/whisper-medium.en-mlx` transcription downloads about 1.5 GB and requires explicit user action. Grant microphone access to the browser in **System Settings → Privacy & Security → Microphone**. Run `./scripts/doctor.sh`, then `./start.sh`.

The built-in macOS voice is the verified basic TTS fallback. Kokoro's package can be installed with `uv sync --group tts-apple`, but the current adapter intentionally reports it unavailable rather than invoking an unverified API.
