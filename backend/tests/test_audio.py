
import pytest

from app.services.audio.stt import SpeechError, transcribe_bytes
from app.services.documents.parser import DocumentError, extract_document


def test_rejects_empty_audio():
    with pytest.raises(SpeechError, match="empty"):
        transcribe_bytes(b"", "audio/wav", "mlx-whisper", "small")


def test_extracts_plain_text():
    assert extract_document(b"Python backend engineer", "resume.txt") == "Python backend engineer"


def test_rejects_unknown_document():
    with pytest.raises(DocumentError):
        extract_document(b"data", "resume.exe")
