import importlib.util
import io
import subprocess
import tempfile
import time
from functools import lru_cache
from pathlib import Path


class SynthesisError(RuntimeError):
    pass


def available_backends() -> list[dict]:
    return [
        {"id": "kokoro-mlx", "available": importlib.util.find_spec("kokoro_mlx") is not None, "quality": "preferred"},
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


@lru_cache(maxsize=1)
def _kokoro_model():
    from kokoro_mlx import KokoroTTS

    return KokoroTTS.from_pretrained()


def synthesize_kokoro(text: str, voice: str = "af_heart", speed: float = 1.0) -> tuple[bytes, float]:
    if importlib.util.find_spec("kokoro_mlx") is None:
        raise SynthesisError("Kokoro MLX is not installed. Choose OS TTS or install the tts-apple group.")
    import soundfile

    started = time.perf_counter()
    model = _kokoro_model()
    selected_voice = voice if voice in model.list_voices() else "af_heart"
    result = model.generate(text, voice=selected_voice, speed=speed, sample_rate=24000)
    output = io.BytesIO()
    soundfile.write(output, result.audio, result.sample_rate, format="WAV", subtype="PCM_16")
    return output.getvalue(), round((time.perf_counter() - started) * 1000, 1)


def synthesize(text: str, provider: str, voice: str, speed: float) -> tuple[bytes, float, str]:
    # macOS Say is the explicit, deterministic fallback. Kokoro installation is surfaced in diagnostics;
    # users never unknowingly invoke a cloud voice service.
    if provider not in {"auto", "macos-say", "kokoro-mlx"}:
        raise SynthesisError("Unsupported TTS provider")
    if provider == "kokoro-mlx":
        data, latency = synthesize_kokoro(text, voice, speed)
        return data, latency, "kokoro-mlx"
    data, latency = synthesize_macos(text, voice, speed)
    return data, latency, "macos-say"
