# Agentic development lifecycle

This repository is organized so a coding agent can change it without inventing the product, and so a person can review the result against something written down.

## 1. Spec

Each component has a spec in `docs/specs/`. The spec is the assignment: purpose, non-goals, HTTP and event contracts, data, failure behavior, and what a test must show. An agent starts from that file, not from a one-line prompt.

The event contract is separate because both services have to agree on it and neither owns the other's repository layout.

## 2. Implementation

Cursor or Codex implements the spec inside the conventions in `AGENTS.md` and `.cursor/rules/delivery-platform.mdc`. Those files keep the agent inside this system: two services, parameterized SQL, idempotent consumption, no `terraform apply`.

The agent is expected to match the code to the spec. If the spec is wrong, the spec changes in the same edit so the next session does not implement the old behavior.

## 3. Human review

A person reads the diff for the things the tests only partly cover:

- Does a failed publish leave a retry path, or can the client create a second order?
- Can the consumer write the same order twice?
- Does an invalid message get deleted, or does it reach the DLQ?
- Are IAM actions limited to the topic, queue, and table this service uses?
- Did the change quietly add a third service or a new AWS product?

## 4. Tests and CI

The agent is not done because the process starts. CI on every pull request runs:

- orders-service lint, typecheck, and tests, including PostgreSQL
- fulfillment-service ruff and pytest
- web typecheck and production build
- `terraform fmt -check` and `terraform validate`
- `helm lint` and `helm template`

LocalStack is not part of CI. The cross-service path is `scripts/e2e-local.sh` against Compose, which a person (or an agent session with Docker) runs when the event path changes.

## What this lifecycle is not

It is not a claim about speed, quality scores, or who wrote which line. The specs, the agent instructions, the tests, and CI are the mechanism. The review still belongs to a person.
