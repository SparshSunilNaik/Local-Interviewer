import pytest
from pydantic import ValidationError

from app.schemas.provider import ProviderCreate
from app.services.llm.ollama import OllamaClient


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "http://user:pass@localhost:11434",
        "http://localhost:11434/api/tags",
        "ftp://localhost:11434",
    ],
)
def test_rejects_unsafe_provider_urls(url):
    with pytest.raises(ValidationError):
        ProviderCreate(name="unsafe", base_url=url)


def test_strips_thinking_and_control_tokens():
    value = "<think>private chain</think>Visible question<|im_end|>"
    assert OllamaClient.clean_content(value) == "Visible question"
