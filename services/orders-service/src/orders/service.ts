import { randomUUID } from "node:crypto";
import { toOrderCreatedEvent, type OrderPublisher } from "../messaging/events.js";
import { IdempotencyConflictError, type OrderRepository } from "./repository.js";
import type { CreateOrderInput, OrderRecord } from "./types.js";

export class EventPublishError extends Error {
  readonly orderId: string;

  constructor(orderId: string, options?: { cause?: unknown }) {
    super(`failed to publish order.created for ${orderId}`, options);
    this.name = "EventPublishError";
    this.orderId = orderId;
  }
}

export type CreateOrderResult = {
  order: OrderRecord;
  replayed: boolean;
};

export type CreateOrderDeps = {
  repository: OrderRepository;
  publisher: OrderPublisher;
};

/**
 * Inserts the order, then publishes `order.created`.
 *
 * The row is committed before the SNS publish. If the publish fails, the
 * handler returns 503 and leaves `event_published_at` null. A retry with the
 * same Idempotency-Key publishes again and does not insert a second row.
 * The consumer deduplicates on order id, so a duplicate event is safe.
 */
export async function createOrder(
  deps: CreateOrderDeps,
  input: CreateOrderInput,
  idempotencyKey: string,
): Promise<CreateOrderResult> {
  const existing = await deps.repository.findByIdempotencyKey(idempotencyKey);
  if (existing) {
    const order = await ensurePublished(deps, existing);
    return { order, replayed: true };
  }

  const createdAt = new Date().toISOString();
  const draft = {
    id: randomUUID(),
    idempotencyKey,
    eventId: randomUUID(),
    customerName: input.customerName,
    address: input.address,
    items: input.items,
    notes: input.notes,
    createdAt,
  };

  try {
    await deps.repository.insert(draft);
  } catch (error) {
    if (!(error instanceof IdempotencyConflictError)) {
      throw error;
    }
    const winner = await deps.repository.findByIdempotencyKey(idempotencyKey);
    if (!winner) {
      throw error;
    }
    const order = await ensurePublished(deps, winner);
    return { order, replayed: true };
  }

  const stored = await deps.repository.findById(draft.id);
  const order = await ensurePublished(
    deps,
    stored ?? { ...draft, eventPublishedAt: null },
  );
  return { order, replayed: false };
}

async function ensurePublished(deps: CreateOrderDeps, order: OrderRecord): Promise<OrderRecord> {
  if (order.eventPublishedAt) {
    return order;
  }
  try {
    await deps.publisher.publish(toOrderCreatedEvent(order));
  } catch (error) {
    throw new EventPublishError(order.id, { cause: error });
  }
  const publishedAt = new Date().toISOString();
  await deps.repository.markPublished(order.id, publishedAt);
  return { ...order, eventPublishedAt: publishedAt };
}
