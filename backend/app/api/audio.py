import asyncio
import shutil
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field

from app.services.audio import stt, tts
from app.services.documents.parser import DocumentError, extract_document

router = APIRouter(tags=["audio", "documents"])
MAX_AUDIO_BYTES = 25 * 1024 * 1024
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024


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
):
    data = await file.read(MAX_AUDIO_BYTES + 1)
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio exceeds the 25 MB limit")
    try:
        return await asyncio.to_thread(stt.transcribe_bytes, data, file.content_type or "", backend, model)
    except stt.SpeechError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


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
