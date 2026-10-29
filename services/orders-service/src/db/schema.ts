export const MIGRATION_001 = `
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  event_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  address TEXT NOT NULL,
  items JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  event_published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
`;
