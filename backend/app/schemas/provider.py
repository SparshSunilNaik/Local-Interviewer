from datetime import datetime
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProviderBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_url: str = Field(max_length=500)
    model: str = Field(default="qwen3:8b", min_length=1, max_length=200)
    is_default: bool = False
    temperature: float = Field(default=0.5, ge=0, le=2)
    context_length: int = Field(default=8192, ge=1024, le=131072)
    max_tokens: int = Field(default=512, ge=32, le=8192)
    timeout_seconds: int = Field(default=120, ge=5, le=600)
    retries: int = Field(default=1, ge=0, le=3)
    keep_alive: str = Field(default="10m", max_length=30)
    thinking: bool = False

    @field_validator("base_url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        parsed = urlsplit(value.rstrip("/"))
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError("Use an http:// or https:// Ollama URL")
        if parsed.username or parsed.password:
            raise ValueError("Credentials must not be embedded in URLs")
        if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
            raise ValueError("Ollama base URL cannot include a path, query, or fragment")
        port = parsed.port
        if port is not None and not 1 <= port <= 65535:
            raise ValueError("Invalid port")
        return value.rstrip("/")


class ProviderCreate(ProviderBase):
    pass


class ProviderRead(ProviderBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


class ProviderTestResult(BaseModel):
    ok: bool
    latency_ms: float | None = None
    version: str | None = None
    models: list[str] = []
    error: str | None = None
