import importlib.util
import json
import logging
import math
import re
import subprocess
import tempfile
import threading
import time
from pathlib import Path

import numpy as np
import soundfile as sf

logger = logging.getLogger("uvicorn.error")

MEDIUM_EN_MODEL = "mlx-community/whisper-medium.en-mlx"
ALLOWED_MODELS = {MEDIUM_EN_MODEL}
DOMAIN_PROMPT = (
    "Domain vocabulary: Astra, Sparsh, Python, asyncio, FastAPI, Ollama, Qwen, "
    "RAG, LLM, API, machine learning."
)
_MLX_INFERENCE_LOCK = threading.Lock()


class SpeechError(RuntimeError):
    pass


def available_backends() -> list[dict]:
    return [
        {
            "id": "mlx-whisper",
            "available": importlib.util.find_spec("mlx_whisper") is not None,
            "recommended": True,
            "models": sorted(ALLOWED_MODELS),
        },
        {
            "id": "faster-whisper",
            "available": importlib.util.find_spec("faster_whisper") is not None,
            "recommended": False,
        },
    ]


def _probe(path: Path) -> dict:
    process = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=sample_rate,channels,duration,codec_name:format=duration",
            "-of",
            "json",
            str(path),
        ],
        capture_output=True,
        timeout=30,
        check=False,
        text=True,
    )
    if process.returncode != 0:
        raise SpeechError("Audio could not be inspected. Record again using a supported format.")
    probe = json.loads(process.stdout)
    streams = probe.get("streams", [])
    if not streams:
        raise SpeechError("The recording contains no audio stream.")
    stream = streams[0]
    duration_value = stream.get("duration") or probe.get("format", {}).get("duration")
    try:
        container_duration = float(duration_value) if duration_value not in {None, "N/A"} else None
    except (TypeError, ValueError):
        container_duration = None
    if container_duration is not None and container_duration <= 0:
        container_duration = None
    return {
        "sample_rate": int(stream.get("sample_rate") or 0),
        "channels": int(stream.get("channels") or 0),
        "container_duration_seconds": round(container_duration, 3) if container_duration else None,
        "codec": stream.get("codec_name", "unknown"),
    }


def normalize_audio(source: Path, target: Path) -> None:
    process = subprocess.run(
        [
            "ffmpeg",
            "-nostdin",
            "-v",
            "error",
            "-i",
            str(source),
            "-map_metadata",
            "-1",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            "-f",
            "wav",
            "-y",
            str(target),
        ],
        capture_output=True,
        timeout=60,
        check=False,
    )
    if process.returncode != 0:
        raise SpeechError("Audio could not be decoded. Record again or choose a supported browser format.")


def analyze_wav(path: Path) -> dict:
    samples, sample_rate = sf.read(path, dtype="float32", always_2d=False)
    if samples.ndim > 1:
        samples = samples.mean(axis=1)
    if samples.size == 0:
        raise SpeechError("The recording contains no audio samples.")
    absolute = np.abs(samples)
    rms = float(np.sqrt(np.mean(np.square(samples))))
    peak = float(np.max(absolute))
    clipping = float(np.mean(absolute >= 0.99) * 100)
    frame_size = max(1, round(sample_rate * 0.03))
    active_frames = 0
    for offset in range(0, samples.size, frame_size):
        frame = samples[offset : offset + frame_size]
        frame_rms = float(np.sqrt(np.mean(np.square(frame)))) if frame.size else 0
        if frame_rms >= 0.008:
            active_frames += 1
    active_seconds = min(samples.size / sample_rate, active_frames * frame_size / sample_rate)
    return {
        "normalized_sample_rate": sample_rate,
        "normalized_duration_seconds": round(samples.size / sample_rate, 3),
        "peak_amplitude": round(peak, 5),
        "rms_amplitude": round(rms, 5),
        "clipping_percentage": round(clipping, 4),
        "speech_active_seconds": round(active_seconds, 3),
    }


def combine_audio_metrics(input_info: dict, decoded_metrics: dict, mime: str) -> dict:
    container_duration = input_info["container_duration_seconds"]
    return {
        **input_info,
        **decoded_metrics,
        "input_duration_seconds": container_duration
        or decoded_metrics["normalized_duration_seconds"],
        "input_duration_source": "container" if container_duration else "decoded_fallback",
        "input_mime_type": mime,
    }


def _confidence(result: dict) -> float | None:
    log_probs = [segment.get("avg_logprob") for segment in result.get("segments", [])]
    values = [float(value) for value in log_probs if value is not None]
    return round(min(1.0, max(0.0, math.exp(sum(values) / len(values)))), 3) if values else None


def transcribe_bytes(data: bytes, content_type: str, backend: str, model: str) -> dict:
    if len(data) < 1000:
        raise SpeechError("The recording is empty or too short to transcribe.")
    mime = content_type.split(";")[0].lower()
    suffix = {
        "audio/webm": ".webm",
        "audio/mp4": ".m4a",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/ogg": ".ogg",
    }.get(mime)
    if suffix is None:
        raise SpeechError(f"Unsupported audio format: {mime or 'missing content type'}")
    if backend == "mlx-whisper" and model not in ALLOWED_MODELS:
        raise SpeechError("Unsupported MLX Whisper model selection")

    started = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix="local-interviewer-stt-") as folder:
        source = Path(folder) / f"input{suffix}"
        normalized = Path(folder) / "normalized.wav"
        source.write_bytes(data)
        input_info = _probe(source)
        normalize_audio(source, normalized)
        decoded_metrics = analyze_wav(normalized)
        metrics = combine_audio_metrics(input_info, decoded_metrics, mime)
        if metrics["rms_amplitude"] < 0.0025 or metrics["speech_active_seconds"] < 0.12:
            raise SpeechError("No speech was detected. Check the microphone and try again.")

        if backend == "mlx-whisper":
            if importlib.util.find_spec("mlx_whisper") is None:
                raise SpeechError("mlx-whisper is not installed. Run setup.sh with STT enabled.")
            import mlx_whisper

            with _MLX_INFERENCE_LOCK:
                result = mlx_whisper.transcribe(
                    str(normalized),
                    path_or_hf_repo=model,
                    language="en",
                    task="transcribe",
                    temperature=0.0,
                    condition_on_previous_text=False,
                    no_speech_threshold=0.6,
                    logprob_threshold=-1.0,
                    compression_ratio_threshold=2.4,
                    initial_prompt=DOMAIN_PROMPT,
                    word_timestamps=True,
                    hallucination_silence_threshold=1.0,
                )
            text = result.get("text", "").strip()
            confidence = _confidence(result)
        elif backend == "faster-whisper":
            if importlib.util.find_spec("faster_whisper") is None:
                raise SpeechError("faster-whisper is not installed.")
            from faster_whisper import WhisperModel

            whisper = WhisperModel(model, device="cpu", compute_type="int8")
            segments, _info = whisper.transcribe(
                str(normalized), language="en", task="transcribe", vad_filter=True
            )
            segments = list(segments)
            text = " ".join(segment.text.strip() for segment in segments).strip()
            confidence = None
        else:
            raise SpeechError("Unknown speech recognition backend")

    if not text:
        raise SpeechError("No speech was detected. Check the microphone and try again.")
    latency = round((time.perf_counter() - started) * 1000, 1)
    logger.info(
        "STT completed model=%s mime=%s input_rate=%dHz channels=%d input_duration=%.3fs "
        "normalized_duration=%.3fs "
        "rms=%.5f peak=%.5f clipping=%.4f%% active=%.3fs latency=%.1fms",
        model,
        mime,
        metrics["sample_rate"],
        metrics["channels"],
        metrics["input_duration_seconds"],
        metrics["normalized_duration_seconds"],
        metrics["rms_amplitude"],
        metrics["peak_amplitude"],
        metrics["clipping_percentage"],
        metrics["speech_active_seconds"],
        latency,
    )
    return {
        "text": text,
        "confidence": confidence,
        "needs_review": confidence is None or confidence < 0.55 or metrics["clipping_percentage"] > 1,
        "latency_ms": latency,
        "audio_metrics": metrics,
    }


def _edit_distance(reference: list[str], hypothesis: list[str]) -> int:
    previous = list(range(len(hypothesis) + 1))
    for index, expected in enumerate(reference, 1):
        current = [index]
        for position, actual in enumerate(hypothesis, 1):
            current.append(
                min(current[-1] + 1, previous[position] + 1, previous[position - 1] + (expected != actual))
            )
        previous = current
    return previous[-1]


def error_rates(reference: str, hypothesis: str) -> dict:
    def normalize_words(value: str) -> list[str]:
        return re.findall(r"[a-z0-9]+(?:'[a-z0-9]+)?", value.lower())

    reference_words, hypothesis_words = normalize_words(reference), normalize_words(hypothesis)
    reference_normalized, hypothesis_normalized = " ".join(reference_words), " ".join(hypothesis_words)
    return {
        "wer": round(_edit_distance(reference_words, hypothesis_words) / max(1, len(reference_words)), 4),
        "cer": round(
            _edit_distance(list(reference_normalized), list(hypothesis_normalized))
            / max(1, len(reference_normalized)),
            4,
        ),
    }
