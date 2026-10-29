export type OrderItem = {
  sku: string;
  name: string;
  quantity: number;
};

/** Fields returned by the HTTP API. */
export type PublicOrder = {
  id: string;
  customerName: string;
  address: string;
  items: OrderItem[];
  notes: string | null;
  createdAt: string;
};

/** Persisted order, including fields used only for publish retries. */
export type OrderRecord = PublicOrder & {
  idempotencyKey: string;
  eventId: string;
  eventPublishedAt: string | null;
};

export type NewOrder = {
  id: string;
  idempotencyKey: string;
  eventId: string;
  customerName: string;
  address: string;
  items: OrderItem[];
  notes: string | null;
  createdAt: string;
};

export type CreateOrderInput = {
  customerName: string;
  address: string;
  items: OrderItem[];
  notes: string | null;
};

export function toPublicOrder(order: OrderRecord): PublicOrder {
  return {
    id: order.id,
    customerName: order.customerName,
    address: order.address,
    items: order.items,
    notes: order.notes,
    createdAt: order.createdAt,
  };
}
