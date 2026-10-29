import type { Pool } from "pg";
import { MIGRATION_001 } from "./schema.js";

const MIGRATION_ID = "001_init";

export async function migrate(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const found = await client.query<{ id: string }>(
      "SELECT id FROM schema_migrations WHERE id = $1",
      [MIGRATION_ID],
    );
    if (found.rows.length === 0) {
      await client.query(MIGRATION_001);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [MIGRATION_ID]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function waitForDb(pool: Pool, attempts = 20, delayMs = 500): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("database did not become ready", { cause: lastError });
}
