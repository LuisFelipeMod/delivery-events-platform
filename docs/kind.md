# Run on a local kind cluster

kind runs the containers. It does not provide SNS, SQS, DynamoDB, or RDS. Use Compose when you want the event path. Use this page when you want to see the Helm chart schedule both processes.

## Build and load images

```bash
docker build -t orders-service:local services/orders-service
docker build -t fulfillment-service:local services/fulfillment-service

kind create cluster --name delivery
kind load docker-image orders-service:local --name delivery
kind load docker-image fulfillment-service:local --name delivery
```

## Install

`values-kind.yaml` turns on an in-cluster Postgres (emptyDir, data disappears with the pod) and turns the SQS consumer off so the fulfillment pod does not crash-loop looking for a queue.

```bash
helm upgrade --install delivery deploy/helm/delivery-platform \
  --namespace delivery --create-namespace \
  -f deploy/helm/delivery-platform/values-kind.yaml
```

```bash
kubectl -n delivery rollout status deploy/delivery-orders
kubectl -n delivery rollout status deploy/delivery-fulfillment
kubectl -n delivery port-forward svc/delivery-orders 3001:3001
```

In another terminal:

```bash
kubectl -n delivery port-forward svc/delivery-fulfillment 8000:8000
curl -s localhost:3001/health
curl -s localhost:8000/health
```

`POST /orders` works against the in-cluster database only if `SNS_TOPIC_ARN` is reachable. The default topic ARN points at a LocalStack-shaped name and there is no AWS endpoint in this overlay, so create will save the row and return 503 when publish fails. That is the failure mode in the orders spec. To exercise a successful create on kind, port a LocalStack (or real AWS) endpoint into the values and set `orders.snsTopicArn`, `aws.endpointUrl`, and the fulfillment queue URL, then set `fulfillment.consumerEnabled` to `true`.

## Production-shaped install

Leave `postgres.enabled` false. Set `orders.databaseUrl` to the RDS URL, `orders.snsTopicArn` and `fulfillment.sqsQueueUrl` from Terraform outputs, and annotate the service accounts with the IRSA role ARNs:

```yaml
orders:
  serviceAccount:
    annotations:
      eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/delivery-dev-orders
fulfillment:
  serviceAccount:
    annotations:
      eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/delivery-dev-fulfillment
```

Install into the `delivery` namespace. Those account names and that namespace are what `infra/terraform/iam.tf` trusts. Image tags in ECR are immutable; set `orders.image.repository` and `tag` to the URL and tag you pushed.

## Remove the cluster

```bash
kind delete cluster --name delivery
```
