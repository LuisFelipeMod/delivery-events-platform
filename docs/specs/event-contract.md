# Event contract: `order.created`

## Purpose

Define the only message that crosses from `orders-service` to `fulfillment-service`.

## Envelope

`orders-service` publishes one JSON document as the SNS `Message`. Message attributes:

| Name | Type | Value |
| --- | --- | --- |
| `eventType` | String | `order.created` |
| `eventId` | String | the event id |

The SQS subscription leaves raw message delivery off. The consumer must accept both shapes:

1. An SNS notification whose `Type` is `Notification` and whose `Message` is the JSON document below.
2. The JSON document itself (raw delivery, used by tests and a possible later subscription change).

## Payload

Canonical example: [`fixtures/order.created.json`](fixtures/order.created.json).

| Field | Type | Rule |
| --- | --- | --- |
| `eventId` | string | Stable for one order. A retried publish of the same order reuses it. |
| `eventType` | string | Exactly `order.created`. |
| `occurredAt` | string | ISO-8601 timestamp. Equal to `order.createdAt`. |
| `order.id` | uuid string | Primary key of the order. Idempotency key for fulfillment. |
| `order.customerName` | string | Copied from the order. |
| `order.address` | string | Copied from the order. |
| `order.items` | array | At least one `{ sku, name, quantity }`. `quantity` is an integer >= 1. |
| `order.notes` | string or null | Copied from the order. |
| `order.createdAt` | string | ISO-8601 timestamp stored on the order. |

## Consumer rules

- Treat `order.id` as the idempotency key. A second event for the same order does not change the stored fulfillment record.
- A body that is not this document is invalid. Do not delete that SQS message.
- A transient dependency failure (DynamoDB, for example) also leaves the message on the queue.

## Out of scope

No other event types. No shared schema package. Each service validates this document on its own side.
