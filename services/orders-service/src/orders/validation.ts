import { z } from "zod";

const orderItemSchema = z
  .object({
    sku: z.string().trim().min(1).max(40),
    name: z.string().trim().min(1).max(80),
    quantity: z.number().int().min(1).max(50),
  })
  .strict();

export const createOrderBodySchema = z
  .object({
    customerName: z.string().trim().min(1).max(80),
    address: z.string().trim().min(1).max(200),
    items: z.array(orderItemSchema).min(1).max(20),
    notes: z.string().trim().max(280).nullable().optional(),
  })
  .strict();

export const orderIdSchema = z.string().uuid();

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9._:-]+$/);

export function parseLimit(value: unknown): { ok: true; limit: number } | { ok: false } {
  if (value === undefined) {
    return { ok: true, limit: 20 };
  }
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return { ok: false };
  }
  const limit = Number(value);
  if (limit < 1 || limit > 100) {
    return { ok: false };
  }
  return { ok: true, limit };
}

export function formatZodError(error: z.ZodError): {
  error: "validation_error";
  details: { path: string; message: string }[];
} {
  return {
    error: "validation_error",
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
