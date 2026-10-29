import boto3
from moto import mock_aws

from fulfillment.store import DynamoFulfillmentStore


def _table():
    resource = boto3.resource("dynamodb", region_name="us-east-1")
    return resource.create_table(
        TableName="fulfillments",
        KeySchema=[{"AttributeName": "orderId", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "orderId", "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
    )


@mock_aws
def test_accept_is_idempotent_on_order_id(order_created_event):
    store = DynamoFulfillmentStore(_table())
    first = store.accept(order_created_event)
    duplicate = order_created_event.model_copy(update={"eventId": "another-event"})
    second = store.accept(duplicate)

    assert first.created is True
    assert second.created is False
    assert second.record.eventId == first.record.eventId
    assert second.record.acceptedAt == first.record.acceptedAt
    assert store.get(order_created_event.order.id).status == "accepted"
    assert store.get(order_created_event.order.id).itemCount == 2


@mock_aws
def test_get_returns_none_when_missing():
    store = DynamoFulfillmentStore(_table())
    assert store.get("missing") is None
