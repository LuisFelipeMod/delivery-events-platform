# fulfillment-service

Python service that reads `order.created` from SQS and stores fulfillment status in DynamoDB.

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
ruff check src tests
pytest
```

The consumer starts with the API process. Set `CONSUMER_ENABLED=false` to serve `/health` and `/fulfillments/{orderId}` without polling. See `docs/specs/fulfillment-service.md`.
