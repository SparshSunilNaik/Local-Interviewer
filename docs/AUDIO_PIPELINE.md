# Audio Pipeline

## Input

The browser requests a selected microphone only after user action, enables echo cancellation/noise suppression, chooses a supported `MediaRecorder` MIME type, emits 250 ms chunks, and computes a local Web Audio amplitude meter. Stopping releases every device track. The bounded blob is uploaded with actual content type.

FFmpeg decodes and normalizes to mono 16 kHz WAV. On Apple Silicon, `mlx-whisper` is preferred; `faster-whisper` is the portable fallback. Empty audio and missing engines are explicit errors. The candidate must review, edit, retry, or explicitly submit the transcript. Confidence is shown as unavailable when the backend cannot calculate it.

## Output

Text is capped and contains interview dialogue only. TTS returns mono 24 kHz WAV with provider and measured synthesis latency headers. Playback is cancelable and recording controls remain disabled while Astra speaks. macOS `say` is the verified local fallback. Temporary directories are automatically removed.

No browser Web Speech API is used because implementations may contact cloud services. Raw audio is not persisted by default.
