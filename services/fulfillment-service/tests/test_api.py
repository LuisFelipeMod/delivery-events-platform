from fastapi.testclient import TestClient

from fulfillment.app import create_app
from fulfillment.config import Settings
from fulfillment.models import AcceptResult, FulfillmentRecord


class MemoryStore:
    def __init__(self) -> None:
        self.records: dict[str, FulfillmentRecord] = {}

    def accept(self, event) -> AcceptResult:
        record = FulfillmentRecord(
            orderId=event.order.id,
            eventId=event.eventId,
            status="accepted",
            customerName=event.order.customerName,
            address=event.order.address,
            itemCount=len(event.order.items),
            itemsJson="[]",
            acceptedAt="2026-01-01T00:00:00+00:00",
        )
        created = event.order.id not in self.records
        self.records.setdefault(event.order.id, record)
        return AcceptResult(created=created, record=self.records[event.order.id])

    def get(self, order_id: str) -> FulfillmentRecord | None:
        return self.records.get(order_id)


def _client(store: MemoryStore) -> TestClient:
    app = create_app(
        settings=Settings(consumer_enabled=False, sqs_queue_url="", log_level="warning"),
        store=store,
    )
    return TestClient(app)


def test_health_reports_a_disabled_consumer():
    with _client(MemoryStore()) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "fulfillment", "consumer": "disabled"}


def test_status_is_not_found_then_readable():
    store = MemoryStore()
    with _client(store) as client:
        missing = client.get("/fulfillments/missing")
        assert missing.status_code == 404
        assert missing.json()["detail"]["error"] == "not_found"

        store.records["order-1"] = FulfillmentRecord(
            orderId="order-1",
            eventId="event-1",
            status="accepted",
            customerName="Ada Lovelace",
            address="1 Market St",
            itemCount=2,
            itemsJson="[]",
            acceptedAt="2026-01-01T00:00:00+00:00",
        )
        found = client.get("/fulfillments/order-1")
    assert found.status_code == 200
    body = found.json()
    assert body["status"] == "accepted"
    assert body["itemCount"] == 2
    assert "itemsJson" not in body
