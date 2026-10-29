import json

import boto3
from moto import mock_aws

from fulfillment.consumer import poll_once
from fulfillment.store import DynamoFulfillmentStore


def _queue_with_dlq():
    sqs = boto3.client("sqs", region_name="us-east-1")
    dlq_url = sqs.create_queue(QueueName="order-created-dlq")["QueueUrl"]
    dlq_arn = sqs.get_queue_attributes(QueueUrl=dlq_url, AttributeNames=["QueueArn"])["Attributes"][
        "QueueArn"
    ]
    queue_url = sqs.create_queue(
        QueueName="order-created",
        Attributes={
            "VisibilityTimeout": "30",
            "RedrivePolicy": json.dumps({"deadLetterTargetArn": dlq_arn, "maxReceiveCount": "1"}),
        },
    )["QueueUrl"]
    return sqs, queue_url, dlq_url


def _table():
    resource = boto3.resource("dynamodb", region_name="us-east-1")
    return resource.create_table(
        TableName="fulfillments",
        KeySchema=[{"AttributeName": "orderId", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "orderId", "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
    )


@mock_aws
def test_successful_message_is_deleted(order_created_event):
    sqs, queue_url, _dlq_url = _queue_with_dlq()
    sqs.send_message(QueueUrl=queue_url, MessageBody=order_created_event.model_dump_json())
    store = DynamoFulfillmentStore(_table())

    handled = poll_once(sqs, queue_url, store, wait_seconds=0, visibility_timeout=30)

    assert handled == 1
    assert store.get(order_created_event.order.id) is not None
    remaining = sqs.receive_message(QueueUrl=queue_url, MaxNumberOfMessages=1, WaitTimeSeconds=0)
    assert "Messages" not in remaining


@mock_aws
def test_invalid_message_is_left_for_redrive():
    sqs, queue_url, dlq_url = _queue_with_dlq()
    sqs.send_message(QueueUrl=queue_url, MessageBody="not-json")
    store = DynamoFulfillmentStore(_table())

    # maxReceiveCount is 1. The first receive increments the count; a later
    # receive that exceeds it is moved to the DLQ by SQS.
    assert poll_once(sqs, queue_url, store, wait_seconds=0, visibility_timeout=0) == 0
    assert poll_once(sqs, queue_url, store, wait_seconds=0, visibility_timeout=0) == 0

    dead = sqs.receive_message(QueueUrl=dlq_url, MaxNumberOfMessages=1, WaitTimeSeconds=1)
    assert dead["Messages"][0]["Body"] == "not-json"
    assert store.get("anything") is None


@mock_aws
def test_sns_envelope_is_accepted(order_created_event):
    sqs, queue_url, _dlq_url = _queue_with_dlq()
    envelope = {
        "Type": "Notification",
        "MessageId": "sns-1",
        "Message": order_created_event.model_dump_json(),
    }
    sqs.send_message(QueueUrl=queue_url, MessageBody=json.dumps(envelope))
    store = DynamoFulfillmentStore(_table())

    assert poll_once(sqs, queue_url, store, wait_seconds=0, visibility_timeout=5) == 1
    assert store.get(order_created_event.order.id).eventId == order_created_event.eventId
