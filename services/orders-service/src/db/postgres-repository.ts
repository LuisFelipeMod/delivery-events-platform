import type { Pool } from "pg";
import { IdempotencyConflictError, type OrderRepository } from "../orders/repository.js";
import type { NewOrder, OrderItem, OrderRecord } from "../orders/types.js";

type OrderRow = {
  id: string;
  idempotency_key: string;
  event_id: string;
  customer_name: string;
  address: string;
  items: OrderItem[];
  notes: string | null;
  created_at: Date;
  event_published_at: Date | null;
};

const COLUMNS = `
  id, idempotency_key, event_id, customer_name, address, items, notes, created_at, event_published_at
`;

function mapRow(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    eventId: row.event_id,
    customerName: row.customer_name,
    address: row.address,
    items: row.items,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
    eventPublishedAt: row.event_published_at ? row.event_published_at.toISOString() : null,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly pool: Pool) {}

  async insert(order: NewOrder): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO orders (
           id, idempotency_key, event_id, customer_name, address, items, notes, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
        [
          order.id,
          order.idempotencyKey,
          order.eventId,
          order.customerName,
          order.address,
          JSON.stringify(order.items),
          order.notes,
          order.createdAt,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new IdempotencyConflictError();
      }
      throw error;
    }
  }

  async findById(id: string): Promise<OrderRecord | null> {
    const result = await this.pool.query<OrderRow>(
      `SELECT ${COLUMNS} FROM orders WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }

  async findByIdempotencyKey(key: string): Promise<OrderRecord | null> {
    const result = await this.pool.query<OrderRow>(
      `SELECT ${COLUMNS} FROM orders WHERE idempotency_key = $1`,
      [key],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }

  async markPublished(id: string, publishedAt: string): Promise<void> {
    const result = await this.pool.query(
      "UPDATE orders SET event_published_at = $2 WHERE id = $1",
      [id, publishedAt],
    );
    if (result.rowCount !== 1) {
      throw new Error(`order ${id} was not found when marking the event published`);
    }
  }

  async list(limit: number): Promise<OrderRecord[]> {
    const result = await this.pool.query<OrderRow>(
      `SELECT ${COLUMNS} FROM orders ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapRow);
  }
}
