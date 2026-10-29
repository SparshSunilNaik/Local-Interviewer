
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from app.services.audio.stt import SpeechError, analyze_wav, error_rates, transcribe_bytes
from app.services.documents.parser import DocumentError, extract_document


def test_rejects_empty_audio():
    with pytest.raises(SpeechError, match="empty"):
        transcribe_bytes(b"", "audio/wav", "mlx-whisper", "small")


def write_wav(path: Path, samples: np.ndarray, sample_rate: int = 16000) -> bytes:
    sf.write(path, samples, sample_rate, subtype="PCM_16")
    return path.read_bytes()


def test_rejects_silence_before_model_inference(tmp_path):
    data = write_wav(tmp_path / "silence.wav", np.zeros(32000, dtype=np.float32))
    with pytest.raises(SpeechError, match="No speech"):
        transcribe_bytes(
            data, "audio/wav", "mlx-whisper", "mlx-community/whisper-base.en-mlx"
        )


def test_reports_clipping_and_audio_duration(tmp_path):
    samples = np.ones(16000, dtype=np.float32)
    write_wav(tmp_path / "clipped.wav", samples)
    metrics = analyze_wav(tmp_path / "clipped.wav")
    assert metrics["normalized_duration_seconds"] == 1
    assert metrics["peak_amplitude"] >= 0.99
    assert metrics["clipping_percentage"] > 99


def test_rejects_unknown_audio_format_and_model():
    with pytest.raises(SpeechError, match="Unsupported audio format"):
        transcribe_bytes(b"x" * 2000, "audio/aac", "mlx-whisper", "mlx-community/whisper-base.en-mlx")
    with pytest.raises(SpeechError, match="model selection"):
        transcribe_bytes(b"x" * 2000, "audio/wav", "mlx-whisper", "unapproved/model")


def test_word_and_character_error_rates_ignore_case_and_punctuation():
    assert error_rates("Hello, Python API!", "hello python api") == {"wer": 0.0, "cer": 0.0}
    rates = error_rates("Hello 123 123 mic testing", "Hello 123 mic testing")
    assert rates["wer"] == 0.2
    assert 0 < rates["cer"] < rates["wer"]


def test_extracts_plain_text():
    assert extract_document(b"Python backend engineer", "resume.txt") == "Python backend engineer"


def test_rejects_unknown_document():
    with pytest.raises(DocumentError):
        extract_document(b"data", "resume.exe")
