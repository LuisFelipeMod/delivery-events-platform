import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../src/db/migrate.js";
import { PostgresOrderRepository } from "../src/db/postgres-repository.js";
import { buildApp } from "../src/http/app.js";
import { FakePublisher } from "./fakes.js";

const databaseUrl = process.env.DATABASE_URL;
const describeIf = databaseUrl ? describe : describe.skip;

describeIf("postgres repository", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const repository = new PostgresOrderRepository(pool);

  beforeAll(async () => {
    await migrate(pool);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE orders");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("persists an order and reads it back through the API", async () => {
    const publisher = new FakePublisher();
    const app = await buildApp({
      repository,
      publisher,
      checkDb: async () => {
        await pool.query("SELECT 1");
      },
      logger: false,
    });

    const created = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { "idempotency-key": "pg-1" },
      payload: {
        customerName: "Katherine Johnson",
        address: "2 Orbit Rd",
        items: [{ sku: "CLD", name: "Cold Brew", quantity: 1 }],
      },
    });
    expect(created.statusCode).toBe(201);
    const orderId = created.json().id as string;

    const fetched = await app.inject({ method: "GET", url: `/orders/${orderId}` });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toMatchObject({
      id: orderId,
      customerName: "Katherine Johnson",
      notes: null,
      items: [{ sku: "CLD", name: "Cold Brew", quantity: 1 }],
    });
    expect(publisher.events).toHaveLength(1);

    const replay = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { "idempotency-key": "pg-1" },
      payload: {
        customerName: "Katherine Johnson",
        address: "2 Orbit Rd",
        items: [{ sku: "CLD", name: "Cold Brew", quantity: 1 }],
      },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().id).toBe(orderId);
    expect(publisher.events).toHaveLength(1);

    const listed = await app.inject({ method: "GET", url: "/orders" });
    expect(listed.json().orders).toHaveLength(1);
    await app.close();
  });
});
