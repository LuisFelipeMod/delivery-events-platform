import { IdempotencyConflictError, type OrderRepository } from "../src/orders/repository.js";
import type { NewOrder, OrderRecord } from "../src/orders/types.js";

export class MemoryOrderRepository implements OrderRepository {
  private readonly byId = new Map<string, OrderRecord>();
  private readonly byKey = new Map<string, string>();

  async insert(order: NewOrder): Promise<void> {
    if (this.byKey.has(order.idempotencyKey)) {
      throw new IdempotencyConflictError();
    }
    const record: OrderRecord = { ...order, eventPublishedAt: null };
    this.byId.set(record.id, record);
    this.byKey.set(record.idempotencyKey, record.id);
  }

  async findById(id: string): Promise<OrderRecord | null> {
    return this.byId.get(id) ?? null;
  }

  async findByIdempotencyKey(key: string): Promise<OrderRecord | null> {
    const id = this.byKey.get(key);
    return id ? (this.byId.get(id) ?? null) : null;
  }

  async markPublished(id: string, publishedAt: string): Promise<void> {
    const current = this.byId.get(id);
    if (!current) {
      throw new Error(`order ${id} was not found when marking the event published`);
    }
    this.byId.set(id, { ...current, eventPublishedAt: publishedAt });
  }

  async list(limit: number): Promise<OrderRecord[]> {
    return [...this.byId.values()]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  }
}
