import type { NewOrder, OrderRecord } from "./types.js";

export interface OrderRepository {
  insert(order: NewOrder): Promise<void>;
  findById(id: string): Promise<OrderRecord | null>;
  findByIdempotencyKey(key: string): Promise<OrderRecord | null>;
  markPublished(id: string, publishedAt: string): Promise<void>;
  list(limit: number): Promise<OrderRecord[]>;
}

/** Raised when an insert loses the race on idempotency_key. */
export class IdempotencyConflictError extends Error {
  constructor() {
    super("idempotency key already exists");
    this.name = "IdempotencyConflictError";
  }
}
