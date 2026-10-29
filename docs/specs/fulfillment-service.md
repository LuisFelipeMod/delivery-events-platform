# Spec: fulfillment-service

## Purpose

Consume `order.created` from SQS and record that fulfillment accepted the order. Expose the status over HTTP.

## Out of scope

- Courier assignment, kitchen tickets, or status transitions beyond `accepted`.
- Publishing further events.
- A separate worker process. The consumer loop runs inside the API process.

## Runtime

- Python 3.12, FastAPI, boto3, pydantic v2.
- Settings (environment, case-insensitive): `AWS_REGION` (default `us-east-1`), `AWS_ENDPOINT_URL` (optional), `SQS_QUEUE_URL`, `DYNAMODB_TABLE` (default `fulfillments`), `POLL_WAIT_SECONDS` (default `2`), `VISIBILITY_TIMEOUT_SECONDS` (default `30`), `CONSUMER_ENABLED` (default `true`), `LOG_LEVEL` (default `info`), `CORS_ORIGINS` (default `*`).
- When `CONSUMER_ENABLED` is true, the FastAPI lifespan starts a background poll loop. When the queue URL is empty, the loop logs and waits instead of calling SQS.
- Logs are single-line JSON on stdout. Accepted and duplicate events log `orderId` and `eventId`. Invalid messages log a warning and the SQS message id, not the body.

## Processing

`poll_once` receives up to 5 messages.

For each message:

1. Parse the body with the rules in `event-contract.md`.
2. Write the fulfillment record if `orderId` does not exist.
3. Delete the message only after that write succeeds.

If the body is invalid, or if DynamoDB (or anything else) raises, do not delete the message. SQS will redeliver it. After `maxReceiveCount` (5 in this project) the queue's redrive policy moves it to the DLQ. The application does not write to the DLQ itself.

Idempotency:

- Conditional `PutItem` with `attribute_not_exists(orderId)`.
- `ConditionalCheckFailedException` means the order was already accepted. Read the existing item and treat the message as success so it is deleted.
- The second event does not overwrite `eventId`, `acceptedAt`, or `status`.

## DynamoDB item

Table hash key: `orderId` (string).

| Attribute | Meaning |
| --- | --- |
| `orderId` | `order.id` |
| `eventId` | Event that won the first write |
| `status` | `accepted` |
| `customerName` | Copied from the event |
| `address` | Copied from the event |
| `itemCount` | Sum of `items[].quantity` |
| `itemsJson` | JSON string of the items, for inspection |
| `acceptedAt` | ISO-8601 time of the first successful write |

## HTTP

### `GET /health`

`200`

```json
{ "status": "ok", "service": "fulfillment", "consumer": "enabled" }
```

`consumer` is `disabled` when the loop is off. This endpoint does not call AWS, so a probe stays fast.

### `GET /fulfillments/{orderId}`

`200`

```json
{
  "orderId": "22222222-2222-4222-8222-222222222222",
  "eventId": "11111111-1111-4111-8111-111111111111",
  "status": "accepted",
  "customerName": "Ada Lovelace",
  "address": "1 Market St",
  "itemCount": 2,
  "acceptedAt": "2026-01-01T00:00:01+00:00"
}
```

`itemsJson` is not returned.

`404` when the order has not been accepted. FastAPI's default detail body is `{ "detail": { "error": "not_found" } }`.

Interactive docs stay at `/docs`.

## Acceptance

- A valid raw event and an SNS notification envelope both create one record and delete the message.
- A second event for the same `order.id` with a different `eventId` does not change the record and still deletes the message.
- An invalid body is not deleted. With `maxReceiveCount` 1 in the unit test, a later receive moves it to the DLQ.
- `/health` and `/fulfillments/{orderId}` behave as above with the consumer disabled.
- Tests use moto for DynamoDB and SQS. They do not need LocalStack.
