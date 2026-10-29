export type OrderItem = {
  sku: string;
  name: string;
  quantity: number;
};

export type PublicOrder = {
  id: string;
  customerName: string;
  address: string;
  items: OrderItem[];
  notes: string | null;
  createdAt: string;
};

export type FulfillmentStatus = {
  orderId: string;
  eventId: string;
  status: string;
  customerName: string;
  itemCount: number;
  acceptedAt: string;
};

const ordersBase = import.meta.env.VITE_ORDERS_API_URL ?? "/orders-api";
const fulfillmentBase = import.meta.env.VITE_FULFILLMENT_API_URL ?? "/fulfillment-api";

export async function createOrder(
  input: {
    customerName: string;
    address: string;
    items: OrderItem[];
    notes: string | null;
  },
  idempotencyKey: string,
): Promise<PublicOrder> {
  const response = await fetch(`${ordersBase}/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
  return response.json() as Promise<PublicOrder>;
}

export async function getFulfillment(orderId: string): Promise<FulfillmentStatus | null> {
  const response = await fetch(`${fulfillmentBase}/fulfillments/${orderId}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
  return response.json() as Promise<FulfillmentStatus>;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? `request failed (${response.status})`;
  } catch {
    return `request failed (${response.status})`;
  }
}
