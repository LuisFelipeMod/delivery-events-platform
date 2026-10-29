import json
from datetime import UTC, datetime
from typing import Protocol

import boto3
from botocore.exceptions import ClientError

from fulfillment.config import Settings
from fulfillment.models import AcceptResult, FulfillmentRecord, OrderCreatedEvent


class FulfillmentStore(Protocol):
    def accept(self, event: OrderCreatedEvent) -> AcceptResult: ...

    def get(self, order_id: str) -> FulfillmentRecord | None: ...


class DynamoFulfillmentStore:
    """Idempotent on orderId. A repeated event returns the original record."""

    def __init__(self, table) -> None:
        self._table = table

    def accept(self, event: OrderCreatedEvent) -> AcceptResult:
        accepted_at = datetime.now(UTC).isoformat()
        record = FulfillmentRecord(
            orderId=event.order.id,
            eventId=event.eventId,
            status="accepted",
            customerName=event.order.customerName,
            address=event.order.address,
            itemCount=sum(item.quantity for item in event.order.items),
            itemsJson=json.dumps([item.model_dump() for item in event.order.items]),
            acceptedAt=accepted_at,
        )
        try:
            self._table.put_item(
                Item=record.model_dump(),
                ConditionExpression="attribute_not_exists(orderId)",
            )
            return AcceptResult(created=True, record=record)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            if code != "ConditionalCheckFailedException":
                raise
        existing = self.get(event.order.id)
        if existing is None:
            raise RuntimeError(f"order {event.order.id} conflicted but was not readable")
        return AcceptResult(created=False, record=existing)

    def get(self, order_id: str) -> FulfillmentRecord | None:
        response = self._table.get_item(Key={"orderId": order_id})
        item = response.get("Item")
        if not item:
            return None
        return _record_from_item(item)


def _record_from_item(item: dict) -> FulfillmentRecord:
    data = dict(item)
    if "itemCount" in data:
        data["itemCount"] = int(data["itemCount"])
    return FulfillmentRecord.model_validate(data)


def dynamodb_table(settings: Settings):
    kwargs: dict[str, str] = {"region_name": settings.aws_region}
    if settings.aws_endpoint_url:
        kwargs["endpoint_url"] = settings.aws_endpoint_url
    return boto3.resource("dynamodb", **kwargs).Table(settings.dynamodb_table)


def sqs_client(settings: Settings):
    kwargs: dict[str, str] = {"region_name": settings.aws_region}
    if settings.aws_endpoint_url:
        kwargs["endpoint_url"] = settings.aws_endpoint_url
    return boto3.client("sqs", **kwargs)
