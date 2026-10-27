import json
import time
from collections.abc import AsyncIterator

import httpx

from app.models.entities import ProviderProfile


class OllamaError(RuntimeError):
    pass


class OllamaClient:
    """A narrowly scoped Ollama client. Base URLs only come from saved profiles."""

    def __init__(self, profile: ProviderProfile):
        self.profile = profile

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.profile.base_url,
            timeout=httpx.Timeout(self.profile.timeout_seconds),
            follow_redirects=False,
            trust_env=False,
        )

    async def test(self) -> dict:
        started = time.perf_counter()
        try:
            async with self._client() as client:
                version_response = await client.get("/api/version")
                self._check(version_response)
                tags_response = await client.get("/api/tags")
                self._check(tags_response)
            tags = tags_response.json().get("models", [])
            return {
                "ok": True,
                "latency_ms": round((time.perf_counter() - started) * 1000, 1),
                "version": version_response.json().get("version"),
                "models": [item.get("name", "") for item in tags if item.get("name")],
            }
        except (httpx.HTTPError, ValueError, OllamaError) as exc:
            return {"ok": False, "error": self._safe_error(exc)}

    async def models(self) -> list[dict]:
        async with self._client() as client:
            response = await client.get("/api/tags")
            self._check(response)
            return response.json().get("models", [])

    async def show(self, model: str) -> dict:
        async with self._client() as client:
            response = await client.post("/api/show", json={"model": model})
            self._check(response)
            data = response.json()
            return {
                "details": data.get("details", {}),
                "model_info": data.get("model_info", {}),
                "capabilities": data.get("capabilities", []),
            }

    async def chat(self, messages: list[dict], *, structured: bool = False) -> dict:
        payload = self._payload(messages, stream=False)
        if structured:
            payload["format"] = "json"
        async with self._client() as client:
            response = await client.post("/api/chat", json=payload)
            self._check(response)
            body = response.json()
            message = body.get("message", {})
            return {
                "content": self.clean_content(message.get("content", "")),
                "thinking": message.get("thinking", ""),
                "metrics": {
                    key: body.get(key)
                    for key in (
                        "total_duration",
                        "load_duration",
                        "prompt_eval_count",
                        "eval_count",
                    )
                },
            }

    async def stream_chat(self, messages: list[dict]) -> AsyncIterator[str]:
        payload = self._payload(messages, stream=True)
        async with self._client() as client:
            async with client.stream("POST", "/api/chat", json=payload) as response:
                self._check(response)
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    chunk = json.loads(line).get("message", {})
                    # Thinking is intentionally ignored and never reaches clients.
                    content = self.clean_content(chunk.get("content", ""))
                    if content:
                        yield content

    def _payload(self, messages: list[dict], stream: bool) -> dict:
        return {
            "model": self.profile.model,
            "messages": messages,
            "stream": stream,
            "think": self.profile.thinking,
            "keep_alive": self.profile.keep_alive,
            "options": {
                "temperature": self.profile.temperature,
                "num_ctx": self.profile.context_length,
                "num_predict": self.profile.max_tokens,
            },
        }

    @staticmethod
    def clean_content(value: str) -> str:
        # Older models may place reasoning in content despite think=false.
        while "<think>" in value and "</think>" in value:
            before, rest = value.split("<think>", 1)
            _, after = rest.split("</think>", 1)
            value = before + after
        return value.replace("<|im_end|>", "").strip()

    @staticmethod
    def _check(response: httpx.Response) -> None:
        if response.is_redirect:
            raise OllamaError("Ollama redirects are blocked; configure the final endpoint directly")
        if response.status_code >= 400:
            detail = ""
            try:
                detail = response.json().get("error", "")
            except ValueError:
                pass
            raise OllamaError(detail or f"Ollama returned HTTP {response.status_code}")

    @staticmethod
    def _safe_error(exc: Exception) -> str:
        if isinstance(exc, httpx.TimeoutException):
            return "Connection timed out. Check the endpoint and timeout setting."
        if isinstance(exc, httpx.ConnectError):
            return "Could not connect to Ollama. Verify that the server is running and reachable."
        return str(exc)[:300]
