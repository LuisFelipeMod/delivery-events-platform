# Agent guide

This repository is a two-service beverage delivery sample. Read the spec for the component you are changing before editing code, and update that spec in the same change when behavior changes.

## Layout

- `services/orders-service` — Node.js, TypeScript, Fastify, PostgreSQL, SNS publish.
- `services/fulfillment-service` — Python, FastAPI, SQS consumer, DynamoDB.
- `web` — React page that calls the two HTTP APIs.
- `docs/specs` — the behavior an implementation is supposed to match.
- `infra/terraform` — AWS reference stack. Validate it. Do not apply it from an agent session.
- `deploy/helm/delivery-platform` — Kubernetes manifests for both services.

## Rules

- Keep the runtime to these two services. Do not add a shared package, a third service, or a transactional-outbox worker unless the spec is updated first.
- The only integration between the services is `order.created`, defined in `docs/specs/event-contract.md`.
- The fulfillment consumer is idempotent on `order.id`. Delete an SQS message only after a successful write. Leave failed and invalid messages on the queue so the redrive policy can move them to the DLQ.
- Orders SQL is parameterized. Do not log secrets. Do not commit real AWS credentials. LocalStack credentials in Compose are the dummy pair `test` / `test`.
- TypeScript is strict ESM. Import local modules with a `.js` suffix. Python 3.12 code uses type hints.
- New behavior needs a test that does not require LocalStack. Orders tests use Fastify `inject`. Fulfillment tests use pytest and moto. The Compose script `scripts/e2e-local.sh` covers the cross-service path.
- Do not run `terraform apply`. CI runs `terraform fmt -check` and `terraform validate` only.

## Checks

```bash
cd services/orders-service && npm run lint && npm test && npm run typecheck
cd services/fulfillment-service && ruff check src tests && pytest
cd web && npm run typecheck && npm run build
cd infra/terraform && terraform fmt -check -recursive && terraform validate
helm lint deploy/helm/delivery-platform
```

Orders integration tests run when `DATABASE_URL` is set. CI provides PostgreSQL. Without it, those tests are skipped and the in-memory API tests still run.
