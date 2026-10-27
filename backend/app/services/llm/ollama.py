import asyncio
import ipaddress
import json
import socket
import time
from collections.abc import AsyncIterator
from urllib.parse import urlsplit

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
            await self._validate_destination()
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
        await self._validate_destination()
        async with self._client() as client:
            response = await client.get("/api/tags")
            self._check(response)
            return response.json().get("models", [])

    async def show(self, model: str) -> dict:
        await self._validate_destination()
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
        await self._validate_destination()
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
        await self._validate_destination()
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

    async def _validate_destination(self) -> None:
        """Resolve immediately before use and reject metadata/special-purpose destinations."""
        host = urlsplit(self.profile.base_url).hostname
        if not host:
            raise OllamaError("Provider hostname is missing")
        try:
            records = await asyncio.get_running_loop().run_in_executor(
                None, lambda: socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
            )
        except socket.gaierror as exc:
            raise OllamaError("Provider hostname could not be resolved") from exc
        addresses = {record[4][0] for record in records}
        self._validate_addresses(addresses)

    @staticmethod
    def _validate_addresses(addresses: set[str]) -> None:
        if not addresses:
            raise OllamaError("Provider hostname resolved to no addresses")
        for value in addresses:
            address = ipaddress.ip_address(value)
            # Loopback and RFC1918/ULA LAN addresses are permitted only because saving the
            # profile is the user's explicit approval. Metadata and special ranges are not.
            if address.is_link_local or address.is_multicast or address.is_unspecified or address.is_reserved:
                raise OllamaError("Provider resolves to a blocked special-purpose address")

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
