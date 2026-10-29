#!/usr/bin/env bash
# Create the local SNS topic, SQS queue, DLQ, subscription, and DynamoDB table.
# Idempotent: safe to run more than once against the same LocalStack.
set -euo pipefail

export AWS_PAGER=""
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"

ENDPOINT="${AWS_ENDPOINT_URL:-http://localstack:4566}"

aws_cli() {
  aws --cli-connect-timeout 5 --cli-read-timeout 30 \
    --endpoint-url "$ENDPOINT" --region "$AWS_DEFAULT_REGION" "$@"
}

echo "waiting for LocalStack at ${ENDPOINT}"
ready=0
for _ in $(seq 1 60); do
  if aws_cli sns list-topics >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" -ne 1 ]]; then
  echo "LocalStack did not become ready" >&2
  exit 1
fi

TOPIC_ARN="$(aws_cli sns create-topic --name order-created --query TopicArn --output text)"
DLQ_URL="$(aws_cli sqs create-queue --queue-name order-created-dlq --query QueueUrl --output text)"
DLQ_ARN="$(aws_cli sqs get-queue-attributes --queue-url "$DLQ_URL" --attribute-names QueueArn --query Attributes.QueueArn --output text)"

aws_cli sqs create-queue --queue-name order-created >/dev/null
QUEUE_URL="$(aws_cli sqs get-queue-url --queue-name order-created --query QueueUrl --output text)"
QUEUE_ARN="$(aws_cli sqs get-queue-attributes --queue-url "$QUEUE_URL" --attribute-names QueueArn --query Attributes.QueueArn --output text)"

cat >/tmp/queue-attrs.json <<EOF
{
  "QueueUrl": "${QUEUE_URL}",
  "Attributes": {
    "VisibilityTimeout": "30",
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"${DLQ_ARN}\",\"maxReceiveCount\":\"5\"}"
  }
}
EOF
aws_cli sqs set-queue-attributes --cli-input-json file:///tmp/queue-attrs.json

cat >/tmp/queue-policy.json <<EOF
{
  "QueueUrl": "${QUEUE_URL}",
  "Attributes": {
    "Policy": "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"AllowSNS\",\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"sns.amazonaws.com\"},\"Action\":\"sqs:SendMessage\",\"Resource\":\"${QUEUE_ARN}\",\"Condition\":{\"ArnEquals\":{\"aws:SourceArn\":\"${TOPIC_ARN}\"}}}]}"
  }
}
EOF
aws_cli sqs set-queue-attributes --cli-input-json file:///tmp/queue-policy.json

EXISTING="$(aws_cli sns list-subscriptions-by-topic \
  --topic-arn "$TOPIC_ARN" \
  --query "length(Subscriptions[?Endpoint=='${QUEUE_ARN}'])" \
  --output text)"
if [[ "$EXISTING" == "0" || "$EXISTING" == "None" ]]; then
  aws_cli sns subscribe \
    --topic-arn "$TOPIC_ARN" \
    --protocol sqs \
    --notification-endpoint "$QUEUE_ARN" \
    --attributes RawMessageDelivery=false >/dev/null
fi

if ! aws_cli dynamodb describe-table --table-name fulfillments >/dev/null 2>&1; then
  aws_cli dynamodb create-table \
    --table-name fulfillments \
    --attribute-definitions AttributeName=orderId,AttributeType=S \
    --key-schema AttributeName=orderId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST >/dev/null
fi
aws_cli dynamodb wait table-exists --table-name fulfillments

echo "topic_arn=${TOPIC_ARN}"
echo "queue_url=${QUEUE_URL}"
echo "queue_arn=${QUEUE_ARN}"
echo "dlq_url=${DLQ_URL}"
echo "dynamodb_table=fulfillments"
