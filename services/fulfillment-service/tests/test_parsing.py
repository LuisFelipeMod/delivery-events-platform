import json

import pytest

from fulfillment.errors import InvalidMessage
from fulfillment.parsing import parse_message_body


def test_parses_a_raw_event(order_created_event):
    parsed = parse_message_body(order_created_event.model_dump_json())
    assert parsed.order.id == order_created_event.order.id


def test_unwraps_an_sns_notification(order_created_event):
    envelope = {
        "Type": "Notification",
        "MessageId": "sns-1",
        "TopicArn": "arn:aws:sns:us-east-1:000000000000:order-created",
        "Message": order_created_event.model_dump_json(),
    }
    parsed = parse_message_body(json.dumps(envelope))
    assert parsed.eventId == order_created_event.eventId


@pytest.mark.parametrize(
    "body",
    ["not-json", json.dumps(["nope"]), json.dumps({"eventType": "other"}), ""],
)
def test_rejects_invalid_bodies(body):
    with pytest.raises(InvalidMessage):
        parse_message_body(body)
