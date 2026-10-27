import importlib.util
import subprocess
import tempfile
import time
from pathlib import Path


class SpeechError(RuntimeError):
    pass


def available_backends() -> list[dict]:
    return [
        {"id": "mlx-whisper", "available": importlib.util.find_spec("mlx_whisper") is not None, "recommended": True},
        {"id": "faster-whisper", "available": importlib.util.find_spec("faster_whisper") is not None, "recommended": False},
    ]


def normalize_audio(source: Path, target: Path) -> None:
    process = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", str(source), "-ac", "1", "-ar", "16000", "-f", "wav", str(target)],
        capture_output=True,
        timeout=60,
        check=False,
    )
    if process.returncode != 0:
        raise SpeechError("Audio could not be decoded. Record again or choose a supported browser format.")


def transcribe_bytes(data: bytes, content_type: str, backend: str, model: str) -> dict:
    if len(data) < 1000:
        raise SpeechError("The recording is empty or too short to transcribe.")
    suffix = {"audio/webm": ".webm", "audio/mp4": ".m4a", "audio/wav": ".wav", "audio/ogg": ".ogg"}.get(content_type.split(";")[0], ".audio")
    started = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix="local-interviewer-stt-") as folder:
        source, normalized = Path(folder) / f"input{suffix}", Path(folder) / "normalized.wav"
        source.write_bytes(data)
        normalize_audio(source, normalized)
        if backend == "mlx-whisper":
            if importlib.util.find_spec("mlx_whisper") is None:
                raise SpeechError("mlx-whisper is not installed. Run setup.sh with STT enabled.")
            import mlx_whisper

            result = mlx_whisper.transcribe(str(normalized), path_or_hf_repo=model, language="en")
            text = result.get("text", "").strip()
            confidence = None
        elif backend == "faster-whisper":
            if importlib.util.find_spec("faster_whisper") is None:
                raise SpeechError("faster-whisper is not installed.")
            from faster_whisper import WhisperModel

            whisper = WhisperModel(model, device="cpu", compute_type="int8")
            segments, _info = whisper.transcribe(str(normalized), language="en", vad_filter=True)
            segments = list(segments)
            text = " ".join(segment.text.strip() for segment in segments).strip()
            confidence = None
        else:
            raise SpeechError("Unknown speech recognition backend")
    if not text:
        raise SpeechError("No speech was detected. Check the microphone and try again.")
    return {"text": text, "confidence": confidence, "latency_ms": round((time.perf_counter() - started) * 1000, 1)}
