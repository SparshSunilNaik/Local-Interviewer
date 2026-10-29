from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.schemas.provider import ProviderCreate
from app.services.llm.ollama import OllamaClient, OllamaError


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


def test_blocks_cloud_metadata_and_special_addresses():
    with pytest.raises(OllamaError, match="blocked"):
        OllamaClient._validate_addresses({"169.254.169.254"})


def test_allows_explicit_local_and_lan_addresses():
    OllamaClient._validate_addresses({"127.0.0.1", "192.168.1.100"})


def test_task_specific_output_budget_does_not_change_profile_default():
    profile = SimpleNamespace(
        model="qwen3:30b",
        thinking=False,
        keep_alive="10m",
        temperature=0.3,
        context_length=8192,
        max_tokens=320,
    )
    client = OllamaClient(profile)
    evaluation = client._payload([], stream=False, max_tokens=1400)
    conversation = client._payload([], stream=False)
    assert evaluation["options"]["num_predict"] == 1400
    assert conversation["options"]["num_predict"] == 320
