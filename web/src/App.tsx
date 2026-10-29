import { useEffect, useState, type FormEvent } from "react";
import { createOrder, getFulfillment, type OrderItem } from "./api";

const MENU: OrderItem[] = [
  { sku: "ESP", name: "Espresso", quantity: 1 },
  { sku: "LAT", name: "Latte", quantity: 1 },
  { sku: "CLD", name: "Cold Brew", quantity: 1 },
  { sku: "CHA", name: "Masala Chai", quantity: 1 },
  { sku: "SPW", name: "Sparkling Water", quantity: 1 },
  { sku: "OJ", name: "Orange Juice", quantity: 1 },
];

type Line = {
  key: string;
  sku: string;
  quantity: number;
};

type PlacedOrder = {
  id: string;
  customerName: string;
  summary: string;
  status: "waiting" | "accepted";
};

function menuItem(sku: string): OrderItem {
  return MENU.find((item) => item.sku === sku) ?? MENU[0]!;
}

export function App() {
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ key: "line-1", sku: "ESP", quantity: 1 }]);
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const waitingIds = orders
    .filter((order) => order.status === "waiting")
    .map((order) => order.id)
    .join(",");

  useEffect(() => {
    if (!waitingIds) {
      return;
    }
    const ids = waitingIds.split(",");
    const timer = window.setInterval(() => {
      for (const id of ids) {
        void getFulfillment(id)
          .then((status) => {
            if (!status || status.status !== "accepted") {
              return;
            }
            setOrders((current) =>
              current.map((order) => (order.id === id ? { ...order, status: "accepted" } : order)),
            );
          })
          .catch(() => undefined);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [waitingIds]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const items = lines.map((line) => {
      const item = menuItem(line.sku);
      return { sku: item.sku, name: item.name, quantity: line.quantity };
    });
    setSubmitting(true);
    try {
      const created = await createOrder(
        {
          customerName: customerName.trim(),
          address: address.trim(),
          items,
          notes: notes.trim() ? notes.trim() : null,
        },
        crypto.randomUUID(),
      );
      setOrders((current) => [
        {
          id: created.id,
          customerName: created.customerName,
          summary: items.map((item) => `${item.quantity} ${item.name}`).join(", "),
          status: "waiting",
        },
        ...current,
      ]);
      setNotes("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "could not create the order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <header>
        <p className="eyebrow">Beverage delivery</p>
        <h1>Brewdrop</h1>
        <p className="lede">
          Place an order. The counter saves it, publishes <code>order.created</code>, and the
          fulfillment desk marks it accepted.
        </p>
      </header>
      <div className="layout">
        <form onSubmit={onSubmit}>
          <label>
            Name
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              required
              maxLength={80}
              autoComplete="name"
            />
          </label>
          <label>
            Address
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              required
              maxLength={200}
              autoComplete="street-address"
            />
          </label>
          <fieldset>
            <legend>Drinks</legend>
            {lines.map((line) => (
              <div className="line" key={line.key}>
                <select
                  aria-label="Drink"
                  value={line.sku}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item) =>
                        item.key === line.key ? { ...item, sku: event.target.value } : item,
                      ),
                    )
                  }
                >
                  {MENU.map((item) => (
                    <option key={item.sku} value={item.sku}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Quantity"
                  type="number"
                  min={1}
                  max={50}
                  value={line.quantity}
                  onChange={(event) => {
                    const quantity = Number(event.target.value);
                    setLines((current) =>
                      current.map((item) =>
                        item.key === line.key
                          ? {
                              ...item,
                              quantity: Number.isInteger(quantity) && quantity >= 1 ? quantity : 1,
                            }
                          : item,
                      ),
                    );
                  }}
                />
                {lines.length > 1 ? (
                  <button
                    type="button"
                    className="text"
                    onClick={() =>
                      setLines((current) => current.filter((item) => item.key !== line.key))
                    }
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              className="text"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { key: crypto.randomUUID(), sku: "LAT", quantity: 1 },
                ])
              }
            >
              Add drink
            </button>
          </fieldset>
          <label>
            Notes
            <input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={280} />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Place order"}
          </button>
        </form>
        <section className="orders" aria-live="polite">
          <h2>This session</h2>
          {orders.length === 0 ? (
            <p className="muted">No orders yet.</p>
          ) : (
            <ul>
              {orders.map((order) => (
                <li key={order.id}>
                  <div>
                    <strong>{order.customerName}</strong>
                    <span>{order.summary}</span>
                  </div>
                  <span className={order.status}>
                    {order.status === "accepted" ? "Accepted" : "Waiting"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
