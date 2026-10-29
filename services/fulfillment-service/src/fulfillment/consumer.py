import asyncio
import logging

from fulfillment.config import Settings
from fulfillment.errors import InvalidMessage
from fulfillment.logging import log
from fulfillment.parsing import parse_message_body
from fulfillment.store import FulfillmentStore


def poll_once(
    sqs,
    queue_url: str,
    store: FulfillmentStore,
    *,
    wait_seconds: int,
    visibility_timeout: int,
) -> int:
    """Process one receive batch.

    A message is deleted only after a successful, idempotent write. Invalid
    or failed messages stay on the queue so the redrive policy can move them
    to the DLQ once maxReceiveCount is exceeded.
    """
    response = sqs.receive_message(
        QueueUrl=queue_url,
        MaxNumberOfMessages=5,
        WaitTimeSeconds=wait_seconds,
        VisibilityTimeout=visibility_timeout,
    )
    handled = 0
    for message in response.get("Messages", []):
        receipt = message["ReceiptHandle"]
        try:
            event = parse_message_body(message["Body"])
            result = store.accept(event)
        except InvalidMessage:
            log(
                logging.WARNING,
                "fulfillment.message_invalid",
                messageId=message.get("MessageId"),
            )
            continue
        except Exception:
            logging.getLogger("fulfillment").exception(
                "fulfillment.message_failed",
                extra={"fields": {"messageId": message.get("MessageId")}},
            )
            continue

        sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=receipt)
        log(
            logging.INFO,
            "fulfillment.accepted" if result.created else "fulfillment.duplicate",
            orderId=result.record.orderId,
            eventId=result.record.eventId,
        )
        handled += 1
    return handled


async def poll_forever(
    stop: asyncio.Event,
    settings: Settings,
    sqs,
    store: FulfillmentStore,
) -> None:
    if not settings.sqs_queue_url:
        log(logging.WARNING, "fulfillment.consumer_idle", reason="SQS_QUEUE_URL is empty")
        await stop.wait()
        return

    while not stop.is_set():
        try:
            await asyncio.to_thread(
                poll_once,
                sqs,
                settings.sqs_queue_url,
                store,
                wait_seconds=settings.poll_wait_seconds,
                visibility_timeout=settings.visibility_timeout_seconds,
            )
        except Exception:
            logging.getLogger("fulfillment").exception("fulfillment.poll_failed")
            try:
                await asyncio.wait_for(stop.wait(), timeout=settings.poll_error_backoff_seconds)
            except TimeoutError:
                continue
