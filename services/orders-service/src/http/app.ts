import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { OrderPublisher } from "../messaging/events.js";
import type { OrderRepository } from "../orders/repository.js";
import { createOrder, EventPublishError } from "../orders/service.js";
import { toPublicOrder } from "../orders/types.js";
import {
  createOrderBodySchema,
  formatZodError,
  idempotencyKeySchema,
  orderIdSchema,
  parseLimit,
} from "../orders/validation.js";
import { randomUUID } from "node:crypto";

export type AppDeps = {
  repository: OrderRepository;
  publisher: OrderPublisher;
  checkDb: () => Promise<void>;
  logger?: boolean;
  logLevel?: string;
  corsOrigin?: string | boolean;
};

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: deps.logger === false ? false : { level: deps.logLevel ?? "info" },
  });

  await app.register(cors, { origin: deps.corsOrigin ?? true });

  app.get("/health", async (_request, reply) => {
    try {
      await deps.checkDb();
    } catch (error) {
      app.log.error({ err: error }, "database health check failed");
      return reply.status(503).send({ status: "degraded", service: "orders", db: "down" });
    }
    return reply.send({ status: "ok", service: "orders", db: "up" });
  });

  app.post("/orders", async (request, reply) => {
    const parsed = createOrderBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(formatZodError(parsed.error));
    }
    const idempotencyKey = readIdempotencyKey(request.headers["idempotency-key"]);
    if (!idempotencyKey.ok) {
      return reply.status(400).send({
        error: "validation_error",
        details: [{ path: "Idempotency-Key", message: idempotencyKey.message }],
      });
    }

    const notes = normalizeNotes(parsed.data.notes);
    try {
      const result = await createOrder(
        { repository: deps.repository, publisher: deps.publisher },
        {
          customerName: parsed.data.customerName,
          address: parsed.data.address,
          items: parsed.data.items,
          notes,
        },
        idempotencyKey.value,
      );
      request.log.info(
        { orderId: result.order.id, eventId: result.order.eventId, replayed: result.replayed },
        "order.created",
      );
      return reply
        .status(result.replayed ? 200 : 201)
        .header("idempotency-key", idempotencyKey.value)
        .header("idempotent-replayed", result.replayed ? "true" : "false")
        .send(toPublicOrder(result.order));
    } catch (error) {
      if (error instanceof EventPublishError) {
        request.log.error({ err: error, orderId: error.orderId }, "sns publish failed");
        return reply.status(503).send({
          error: "event_publish_failed",
          orderId: error.orderId,
          message:
            "Order was saved but order.created was not published. Retry with the same Idempotency-Key.",
        });
      }
      throw error;
    }
  });

  app.get("/orders", async (request, reply) => {
    const query = request.query as { limit?: unknown };
    const limit = parseLimit(query.limit);
    if (!limit.ok) {
      return reply.status(400).send({
        error: "validation_error",
        details: [{ path: "limit", message: "limit must be an integer from 1 to 100" }],
      });
    }
    const orders = await deps.repository.list(limit.limit);
    return reply.send({ orders: orders.map(toPublicOrder) });
  });

  app.get<{ Params: { id: string } }>("/orders/:id", async (request, reply) => {
    const parsed = orderIdSchema.safeParse(request.params.id);
    if (!parsed.success) {
      return reply.status(400).send(formatZodError(parsed.error));
    }
    const order = await deps.repository.findById(parsed.data);
    if (!order) {
      return reply.status(404).send({ error: "not_found" });
    }
    return reply.send(toPublicOrder(order));
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "request failed");
    return reply.status(500).send({ error: "internal_error" });
  });

  return app;
}

function normalizeNotes(notes: string | null | undefined): string | null {
  if (notes === undefined || notes === null) {
    return null;
  }
  return notes.length === 0 ? null : notes;
}

function readIdempotencyKey(
  header: string | string[] | undefined,
): { ok: true; value: string } | { ok: false; message: string } {
  if (header === undefined) {
    return { ok: true, value: randomUUID() };
  }
  if (Array.isArray(header)) {
    return { ok: false, message: "send a single Idempotency-Key header" };
  }
  const parsed = idempotencyKeySchema.safeParse(header);
  if (!parsed.success) {
    return {
      ok: false,
      message: "use 1-80 characters from [A-Za-z0-9._:-]",
    };
  }
  return { ok: true, value: parsed.data };
}
