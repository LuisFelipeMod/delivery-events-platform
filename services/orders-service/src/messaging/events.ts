import type { OrderItem, OrderRecord } from "../orders/types.js";

export type OrderCreatedEvent = {
  eventId: string;
  eventType: "order.created";
  occurredAt: string;
  order: {
    id: string;
    customerName: string;
    address: string;
    items: OrderItem[];
    notes: string | null;
    createdAt: string;
  };
};

export function toOrderCreatedEvent(order: OrderRecord): OrderCreatedEvent {
  return {
    eventId: order.eventId,
    eventType: "order.created",
    occurredAt: order.createdAt,
    order: {
      id: order.id,
      customerName: order.customerName,
      address: order.address,
      items: order.items,
      notes: order.notes,
      createdAt: order.createdAt,
    },
  };
}

export interface OrderPublisher {
  publish(event: OrderCreatedEvent): Promise<void>;
}
