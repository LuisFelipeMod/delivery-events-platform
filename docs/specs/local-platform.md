# Spec: local platform

## Purpose

Run both services, PostgreSQL, and SNS/SQS/DynamoDB on one machine with one command.

## Compose services

| Service | Image / build | Host port |
| --- | --- | --- |
| `postgres` | `postgres:16-alpine` | 5432 |
| `localstack` | `localstack/localstack:4.14.0` | 4566 |
| `localstack-init` | `amazon/aws-cli:2.27.49` plus `scripts/init-localstack.sh` | none |
| `orders-service` | `services/orders-service` Dockerfile | 3001 |
| `fulfillment-service` | `services/fulfillment-service` Dockerfile | 8000 |
| `web` | `web` Dockerfile | 8080 |

`orders-service` starts after Postgres is healthy and `localstack-init` has exited 0. `fulfillment-service` starts after init exits 0.

Local names, fixed by the init script:

- SNS topic `order-created` → `arn:aws:sns:us-east-1:000000000000:order-created`
- SQS queue `order-created`, visibility timeout 30, redrive `maxReceiveCount` 5 to `order-created-dlq`
- Queue policy allows `sns.amazonaws.com` to `sqs:SendMessage` only from that topic
- Subscription with raw message delivery off
- DynamoDB table `fulfillments`, hash key `orderId`, on-demand billing

The fulfillment task uses this queue URL, which resolves inside the Compose network:

`http://localstack:4566/000000000000/order-created`

LocalStack's `get-queue-url` prints a `localhost.localstack.cloud` host instead. That host is for the host machine. The URL above is the one the consumer uses, and LocalStack 4.14 accepts it from another container.

Dummy credentials are `AWS_ACCESS_KEY_ID=test` and `AWS_SECRET_ACCESS_KEY=test`.

## Init script

`scripts/init-localstack.sh` waits until `sns list-topics` succeeds, then creates the resources above. Running it twice does not create a second subscription or a second table.

## End-to-end check

`scripts/e2e-local.sh` waits for both health endpoints, `POST`s an order with an idempotency key, checks the replay returns the same id, reads the order back, and polls `GET /fulfillments/{id}` until `status` is `accepted` and `itemCount` is 2. On timeout it prints the service logs and exits non-zero.

## Out of scope

Compose is the local dependency set. It is not the production topology. Production resource names are prefixed in Terraform (`delivery-dev-...`). The applications read names from the environment, so the two naming schemes do not meet in code.
