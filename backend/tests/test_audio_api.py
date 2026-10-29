import time
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api import audio
from app.main import app


def test_duplicate_recording_model_pair_is_rejected(monkeypatch):
    monkeypatch.setattr(
        audio.stt,
        "transcribe_bytes",
        lambda *_args: {
            "text": "test",
            "confidence": 0.9,
            "needs_review": False,
            "latency_ms": 1,
            "audio_metrics": {},
        },
    )
    recording_id = str(uuid4())
    form = {
        "backend": "mlx-whisper",
        "model": "mlx-community/whisper-medium.en-mlx",
        "recording_id": recording_id,
    }
    files = {"file": ("sample.wav", b"x" * 2000, "audio/wav")}
    with TestClient(app) as client:
        first = client.post("/api/v1/stt/transcribe", data=form, files=files)
        duplicate = client.post("/api/v1/stt/transcribe", data=form, files=files)
    assert first.status_code == 200
    assert duplicate.status_code == 409


def test_stt_inference_requests_are_serialized(monkeypatch):
    active = 0
    maximum_active = 0
    lock = Lock()

    def fake_transcribe(*_args):
        nonlocal active, maximum_active
        with lock:
            active += 1
            maximum_active = max(maximum_active, active)
        time.sleep(0.05)
        with lock:
            active -= 1
        return {
            "text": "test",
            "confidence": 0.9,
            "needs_review": False,
            "latency_ms": 1,
            "audio_metrics": {},
        }

    with ThreadPoolExecutor(max_workers=2) as callers:
        futures = [callers.submit(audio._stt_executor.submit, fake_transcribe) for _ in range(2)]
        stt_futures = [future.result() for future in futures]
        [future.result() for future in stt_futures]
    assert maximum_active == 1
