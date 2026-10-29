.PHONY: test test-orders test-fulfillment lint up down e2e tf-validate helm-lint

test: test-orders test-fulfillment

test-orders:
	cd services/orders-service && npm test

test-fulfillment:
	cd services/fulfillment-service && . .venv/bin/activate && pytest

lint:
	cd services/orders-service && npm run lint && npm run typecheck
	cd services/fulfillment-service && . .venv/bin/activate && ruff check src tests
	cd web && npm run typecheck

up:
	docker compose up --build -d

down:
	docker compose down -v

e2e:
	./scripts/e2e-local.sh

tf-validate:
	cd infra/terraform && terraform init -backend=false -input=false && terraform fmt -check -recursive && terraform validate

helm-lint:
	helm lint deploy/helm/delivery-platform
	helm lint deploy/helm/delivery-platform -f deploy/helm/delivery-platform/values-kind.yaml
