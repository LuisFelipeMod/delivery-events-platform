# orders-service

Fastify service that stores beverage orders in PostgreSQL and publishes `order.created`.

```bash
npm ci
npm run lint
npm test
npm run typecheck
```

Set `DATABASE_URL` to run the PostgreSQL test. Without it, that file is skipped and the in-memory API tests still run.

```bash
DATABASE_URL=postgres://orders:orders@localhost:5432/orders npm test
```

The HTTP contract, the retry behavior, and the table are specified in `docs/specs/orders-service.md`.
