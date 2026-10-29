import asyncio
import shutil
import time
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field

from app.services.audio import stt, tts
from app.services.documents.parser import DocumentError, extract_document

router = APIRouter(tags=["audio", "documents"])
MAX_AUDIO_BYTES = 25 * 1024 * 1024
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
_processed_recordings: dict[tuple[str, str], float] = {}


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    provider: str = "auto"
    voice: str = Field(default="Samantha", max_length=100)
    speed: float = Field(default=1.0, ge=0.6, le=1.5)


@router.get("/diagnostics")
async def diagnostics():
    return {
        "stt": stt.available_backends(),
        "tts": tts.available_backends(),
        "ffmpeg": shutil.which("ffmpeg") is not None,
        "privacy": "All listed engines run locally. Browser cloud speech APIs are never used.",
    }


@router.post("/stt/transcribe")
async def transcribe(
    file: Annotated[UploadFile, File()],
    backend: Annotated[str, Form()] = "mlx-whisper",
    model: Annotated[str, Form()] = "mlx-community/whisper-base.en-mlx",
    recording_id: Annotated[str | None, Form()] = None,
    reference_text: Annotated[str | None, Form()] = None,
):
    data = await file.read(MAX_AUDIO_BYTES + 1)
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio exceeds the 25 MB limit")
    key = (recording_id, model) if recording_id else None
    now = time.monotonic()
    for old_key, timestamp in list(_processed_recordings.items()):
        if now - timestamp > 600:
            _processed_recordings.pop(old_key, None)
    if key and key in _processed_recordings:
        raise HTTPException(status_code=409, detail="This recording was already transcribed with that model")
    if key:
        _processed_recordings[key] = now
    try:
        result = await asyncio.to_thread(
            stt.transcribe_bytes, data, file.content_type or "", backend, model
        )
        if reference_text:
            result["error_rates"] = stt.error_rates(reference_text[:10_000], result["text"])
        return result
    except stt.SpeechError as exc:
        if key:
            _processed_recordings.pop(key, None)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        if key:
            _processed_recordings.pop(key, None)
        raise


@router.post("/tts/synthesize")
async def synthesize(payload: TTSRequest):
    try:
        data, latency, provider = await asyncio.to_thread(
            tts.synthesize, payload.text, payload.provider, payload.voice, payload.speed
        )
    except tts.SynthesisError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return Response(content=data, media_type="audio/wav", headers={"X-TTS-Latency-Ms": str(latency), "X-TTS-Provider": provider})


@router.post("/documents/extract")
async def extract(file: Annotated[UploadFile, File()]):
    data = await file.read(MAX_DOCUMENT_BYTES + 1)
    if len(data) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=413, detail="Document exceeds the 10 MB limit")
    try:
        return {"filename": file.filename, "text": await asyncio.to_thread(extract_document, data, file.filename or "")}
    except DocumentError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
