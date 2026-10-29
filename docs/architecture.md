# Architecture

Brewdrop is a two-service order desk. The counter writes the order and emits a fact. The fulfillment desk reacts to that fact. Neither service calls the other over HTTP.

```mermaid
flowchart LR
  web["Web<br/>React"]
  orders["orders-service<br/>Fastify"]
  pg[("PostgreSQL")]
  topic["SNS topic<br/>order-created"]
  queue["SQS queue"]
  dlq["SQS DLQ"]
  fulfill["fulfillment-service<br/>FastAPI"]
  ddb[("DynamoDB<br/>fulfillments")]

  web -->|POST /orders| orders
  web -->|GET /fulfillments/id| fulfill
  orders --> pg
  orders -->|order.created| topic
  topic --> queue
  queue -->|maxReceiveCount 5| dlq
  queue --> fulfill
  fulfill --> ddb
```

```mermaid
sequenceDiagram
  participant Client
  participant Orders as orders-service
  participant DB as PostgreSQL
  participant SNS
  participant SQS
  participant Fulfill as fulfillment-service
  participant DDB as DynamoDB

  Client->>Orders: POST /orders
  Orders->>DB: INSERT order
  Orders->>SNS: Publish order.created
  SNS->>SQS: Deliver notification
  Orders-->>Client: 201 order
  Fulfill->>SQS: ReceiveMessage
  Fulfill->>DDB: PutItem if orderId is new
  Fulfill->>SQS: DeleteMessage
  Client->>Fulfill: GET /fulfillments/{id}
  Fulfill-->>Client: status accepted
```

If SNS publish fails, the order row stays and the API returns 503. The same `Idempotency-Key` publishes the original event id. If the consumer fails, the message stays invisible until the visibility timeout and is then retried. After five receives it lands on the DLQ. A duplicate event for an order that is already accepted is deleted and does not change the DynamoDB item.

Production targets are RDS PostgreSQL, the real SNS/SQS/DynamoDB resources, ECR, and EKS. Those are declared in Terraform and are not created by the Helm chart. Locally, Compose replaces RDS with Postgres and the AWS APIs with LocalStack. Resource names differ; both services read them from the environment.

Kubernetes runs the two processes. IRSA roles in Terraform match the service account names `orders` and `fulfillment` in the `delivery` namespace.
