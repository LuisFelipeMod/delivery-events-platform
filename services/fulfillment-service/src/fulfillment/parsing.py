import json

from pydantic import ValidationError

from fulfillment.errors import InvalidMessage
from fulfillment.models import OrderCreatedEvent


def parse_message_body(body: str) -> OrderCreatedEvent:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise InvalidMessage("body is not json") from exc
    if not isinstance(payload, dict):
        raise InvalidMessage("body is not an object")

    if payload.get("Type") == "Notification":
        message = payload.get("Message")
        if not isinstance(message, str):
            raise InvalidMessage("sns notification is missing Message")
        try:
            payload = json.loads(message)
        except json.JSONDecodeError as exc:
            raise InvalidMessage("sns Message is not json") from exc
        if not isinstance(payload, dict):
            raise InvalidMessage("sns Message is not an object")

    try:
        return OrderCreatedEvent.model_validate(payload)
    except ValidationError as exc:
        raise InvalidMessage("event does not match order.created") from exc
