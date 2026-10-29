import { readFileSync } from "node:fs";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { buildApp } from "../src/http/app.js";
import { SnsOrderPublisher } from "../src/messaging/sns-publisher.js";
import type { OrderPublisher } from "../src/messaging/events.js";
import { FakePublisher } from "./fakes.js";
import { MemoryOrderRepository } from "./memory-repository.js";

const sampleBody = {
  customerName: "Ada Lovelace",
  address: "1 Market St",
  items: [{ sku: "ESP", name: "Espresso", quantity: 2 }],
  notes: "no sugar",
};

async function createTestApp(publisher: OrderPublisher = new FakePublisher(), checkDb?: () => Promise<void>) {
  const repository = new MemoryOrderRepository();
  const app = await buildApp({
    repository,
    publisher,
    checkDb: checkDb ?? (async () => undefined),
    logger: false,
  });
  return { app, repository, publisher };
}

describe("orders API", () => {
  let publisher: FakePublisher;

  beforeEach(() => {
    publisher = new FakePublisher();
  });

  it("creates an order and publishes order.created once", async () => {
    const { app } = await createTestApp(publisher);
    const response = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { "idempotency-key": "order-1" },
      payload: sampleBody,
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers["idempotent-replayed"]).toBe("false");
    const body = response.json();
    expect(body.customerName).toBe("Ada Lovelace");
    expect(body.notes).toBe("no sugar");
    expect(body.items).toEqual(sampleBody.items);
    expect(publisher.events).toHaveLength(1);
    expect(publisher.events[0]?.eventType).toBe("order.created");
    expect(publisher.events[0]?.order.id).toBe(body.id);
    expect(publisher.events[0]?.occurredAt).toBe(body.createdAt);
    await app.close();
  });

  it("replays the same Idempotency-Key without a second event", async () => {
    const { app } = await createTestApp(publisher);
    const first = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { "idempotency-key": "order-1" },
      payload: sampleBody,
    });
    const second = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { "idempotency-key": "order-1" },
      payload: sampleBody,
    });

    expect(second.statusCode).toBe(200);
    expect(second.headers["idempotent-replayed"]).toBe("true");
    expect(second.json().id).toBe(first.json().id);
    expect(publisher.events).toHaveLength(1);
    await app.close();
  });

  it("returns 503 when publish fails and publishes on retry", async () => {
    publisher.failTimes = 1;
    const { app } = await createTestApp(publisher);
    const failed = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { "idempotency-key": "order-1" },
      payload: sampleBody,
    });
    expect(failed.statusCode).toBe(503);
    expect(failed.json().error).toBe("event_publish_failed");
    expect(publisher.events).toHaveLength(0);

    const retried = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { "idempotency-key": "order-1" },
      payload: sampleBody,
    });
    expect(retried.statusCode).toBe(200);
    expect(retried.json().id).toBe(failed.json().orderId);
    expect(publisher.events).toHaveLength(1);
    await app.close();
  });

  it("rejects an invalid body", async () => {
    const { app } = await createTestApp(publisher);
    const response = await app.inject({
      method: "POST",
      url: "/orders",
      payload: { customerName: "", address: "x", items: [] },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("validation_error");
    expect(publisher.events).toHaveLength(0);
    await app.close();
  });

  it("returns 404 for an unknown order and lists newest first", async () => {
    const { app } = await createTestApp(publisher);
    const missing = await app.inject({
      method: "GET",
      url: "/orders/00000000-0000-4000-8000-000000000000",
    });
    expect(missing.statusCode).toBe(404);

    await app.inject({
      method: "POST",
      url: "/orders",
      headers: { "idempotency-key": "a" },
      payload: sampleBody,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await app.inject({
      method: "POST",
      url: "/orders",
      headers: { "idempotency-key": "b" },
      payload: { ...sampleBody, customerName: "Grace Hopper" },
    });
    const list = await app.inject({ method: "GET", url: "/orders?limit=1" });
    expect(list.statusCode).toBe(200);
    expect(list.json().orders).toHaveLength(1);
    expect(list.json().orders[0].customerName).toBe("Grace Hopper");
    await app.close();
  });

  it("rejects a limit outside 1-100", async () => {
    const { app } = await createTestApp(publisher);
    const response = await app.inject({ method: "GET", url: "/orders?limit=0" });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("reports database health", async () => {
    const healthy = await createTestApp();
    expect((await healthy.app.inject({ method: "GET", url: "/health" })).json()).toMatchObject({
      status: "ok",
      db: "up",
    });
    await healthy.app.close();

    const sick = await createTestApp(new FakePublisher(), async () => {
      throw new Error("connection refused");
    });
    const response = await sick.app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(503);
    expect(response.json().db).toBe("down");
    await sick.app.close();
  });
});

describe("config", () => {
  it("requires the database URL and topic ARN", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ DATABASE_URL: "postgres://localhost/orders" })).toThrow(/SNS_TOPIC_ARN/);
  });
});

describe("event contract", () => {
  it("publishes the documented order.created shape", async () => {
    const fixturePath = fileURLToPath(new URL("../../../docs/specs/fixtures/order.created.json", import.meta.url));
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
    const published = new FakePublisher();
    const { app } = await createTestApp(published);
    await app.inject({
      method: "POST",
      url: "/orders",
      headers: { "idempotency-key": "contract" },
      payload: sampleBody,
    });
    const event = published.events[0];
    expect(event).toBeDefined();
    expect(Object.keys(event ?? {}).sort()).toEqual(Object.keys(fixture).sort());
    expect(Object.keys(event?.order ?? {}).sort()).toEqual(
      Object.keys(fixture.order as Record<string, unknown>).sort(),
    );
    await app.close();
  });
});

describe("SNS publisher", () => {
  it("sends the event JSON and message attributes", async () => {
    const sent: PublishCommand[] = [];
    const client = {
      send: async (command: PublishCommand) => {
        sent.push(command);
        return {};
      },
    } as unknown as SNSClient;
    const publisher = new SnsOrderPublisher("arn:aws:sns:us-east-1:000000000000:order-created", client);
    await publisher.publish({
      eventId: "11111111-1111-4111-8111-111111111111",
      eventType: "order.created",
      occurredAt: "2026-01-01T00:00:00.000Z",
      order: {
        id: "22222222-2222-4222-8222-222222222222",
        customerName: "Ada",
        address: "1 Market St",
        items: [{ sku: "ESP", name: "Espresso", quantity: 1 }],
        notes: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(sent[0]?.input.TopicArn).toBe("arn:aws:sns:us-east-1:000000000000:order-created");
    expect(JSON.parse(sent[0]?.input.Message ?? "{}").eventType).toBe("order.created");
    expect(sent[0]?.input.MessageAttributes?.eventType?.StringValue).toBe("order.created");
  });
});
