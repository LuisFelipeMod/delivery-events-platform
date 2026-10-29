#!/usr/bin/env bash
# Create an order and wait until fulfillment status is accepted.
# Expects docker compose to be up. Run from anywhere.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ORDERS_URL="${ORDERS_URL:-http://localhost:3001}"
FULFILLMENT_URL="${FULFILLMENT_URL:-http://localhost:8000}"
KEY="e2e-$(date +%s)"

wait_for() {
  local url="$1"
  local name="$2"
  for _ in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "${name} is ready"
      return 0
    fi
    sleep 2
  done
  echo "${name} did not become ready at ${url}" >&2
  return 1
}

dump_logs() {
  docker compose logs --tail=100 localstack-init orders-service fulfillment-service || true
}

if ! wait_for "${ORDERS_URL}/health" "orders-service"; then
  dump_logs
  exit 1
fi
if ! wait_for "${FULFILLMENT_URL}/health" "fulfillment-service"; then
  dump_logs
  exit 1
fi

BODY='{"customerName":"Ada Lovelace","address":"1 Market St","items":[{"sku":"ESP","name":"Espresso","quantity":2}],"notes":"no sugar"}'

CREATE="$(curl -fsS -X POST "${ORDERS_URL}/orders" \
  -H "content-type: application/json" \
  -H "idempotency-key: ${KEY}" \
  -d "$BODY")"
ORDER_ID="$(echo "$CREATE" | jq -er .id)"
echo "created order ${ORDER_ID}"

REPLAY="$(curl -fsS -D - -o /tmp/e2e-replay.json -X POST "${ORDERS_URL}/orders" \
  -H "content-type: application/json" \
  -H "idempotency-key: ${KEY}" \
  -d "$BODY")"
REPLAY_ID="$(jq -er .id /tmp/e2e-replay.json)"
if [[ "$REPLAY_ID" != "$ORDER_ID" ]]; then
  echo "idempotent replay returned a different id" >&2
  exit 1
fi
if ! echo "$REPLAY" | grep -qi "idempotent-replayed: true"; then
  echo "expected idempotent-replayed: true" >&2
  echo "$REPLAY" >&2
  exit 1
fi

STORED="$(curl -fsS "${ORDERS_URL}/orders/${ORDER_ID}")"
if [[ "$(echo "$STORED" | jq -er .customerName)" != "Ada Lovelace" ]]; then
  echo "order was not readable from PostgreSQL" >&2
  exit 1
fi

echo "waiting for fulfillment"
for _ in $(seq 1 30); do
  if STATUS="$(curl -fsS "${FULFILLMENT_URL}/fulfillments/${ORDER_ID}" 2>/dev/null)"; then
    if [[ "$(echo "$STATUS" | jq -er .status)" == "accepted" ]]; then
      echo "$STATUS" | jq .
      if [[ "$(echo "$STATUS" | jq -er .itemCount)" != "2" ]]; then
        echo "expected itemCount 2" >&2
        exit 1
      fi
      echo "e2e ok"
      exit 0
    fi
  fi
  sleep 2
done

echo "fulfillment status was not accepted in time" >&2
dump_logs
exit 1
