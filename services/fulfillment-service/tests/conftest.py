import json
from pathlib import Path

import pytest

from fulfillment.models import OrderCreatedEvent

FIXTURE = Path(__file__).resolve().parents[3] / "docs" / "specs" / "fixtures" / "order.created.json"


@pytest.fixture(autouse=True)
def aws_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("AWS_EC2_METADATA_DISABLED", "true")


@pytest.fixture
def order_created_event() -> OrderCreatedEvent:
    return OrderCreatedEvent.model_validate(json.loads(FIXTURE.read_text()))
