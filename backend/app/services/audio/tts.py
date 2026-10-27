import importlib.util
import subprocess
import tempfile
import time
from pathlib import Path


class SynthesisError(RuntimeError):
    pass


def available_backends() -> list[dict]:
    return [
        {"id": "kokoro-mlx", "available": importlib.util.find_spec("mlx_audio") is not None, "quality": "preferred"},
        {"id": "macos-say", "available": Path("/usr/bin/say").exists(), "quality": "basic"},
    ]


def synthesize_macos(text: str, voice: str = "Samantha", speed: float = 1.0) -> tuple[bytes, float]:
    started = time.perf_counter()
    words_per_minute = max(90, min(300, round(175 * speed)))
    with tempfile.TemporaryDirectory(prefix="local-interviewer-tts-") as folder:
        aiff, wav = Path(folder) / "speech.aiff", Path(folder) / "speech.wav"
        result = subprocess.run(
            ["/usr/bin/say", "-v", voice, "-r", str(words_per_minute), "-o", str(aiff), text],
            capture_output=True,
            timeout=60,
            check=False,
        )
        if result.returncode != 0:
            raise SynthesisError("Local OS speech synthesis failed")
        conversion = subprocess.run(
            ["ffmpeg", "-nostdin", "-v", "error", "-i", str(aiff), "-ar", "24000", "-ac", "1", str(wav)],
            capture_output=True,
            timeout=60,
            check=False,
        )
        if conversion.returncode != 0:
            raise SynthesisError("Synthesized audio could not be converted")
        data = wav.read_bytes()
    return data, round((time.perf_counter() - started) * 1000, 1)


def synthesize(text: str, provider: str, voice: str, speed: float) -> tuple[bytes, float, str]:
    # macOS Say is the explicit, deterministic fallback. Kokoro installation is surfaced in diagnostics;
    # users never unknowingly invoke a cloud voice service.
    if provider not in {"auto", "macos-say", "kokoro-mlx"}:
        raise SynthesisError("Unsupported TTS provider")
    if provider == "kokoro-mlx" and importlib.util.find_spec("mlx_audio") is None:
        raise SynthesisError("Kokoro MLX is not installed. Choose OS TTS or install the tts-apple group.")
    if provider == "kokoro-mlx":
        raise SynthesisError("This Kokoro MLX version is not enabled; select the verified OS TTS fallback.")
    data, latency = synthesize_macos(text, voice, speed)
    return data, latency, "macos-say"
