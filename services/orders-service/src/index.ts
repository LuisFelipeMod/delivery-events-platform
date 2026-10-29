import { Pool } from "pg";
import { loadConfig } from "./config.js";
import { migrate, waitForDb } from "./db/migrate.js";
import { PostgresOrderRepository } from "./db/postgres-repository.js";
import { buildApp } from "./http/app.js";
import { SnsOrderPublisher } from "./messaging/sns-publisher.js";

const config = loadConfig();
const pool = new Pool({ connectionString: config.databaseUrl });

await waitForDb(pool);
await migrate(pool);

const app = await buildApp({
  repository: new PostgresOrderRepository(pool),
  publisher: new SnsOrderPublisher(config.topicArn, undefined, config),
  checkDb: async () => {
    await pool.query("SELECT 1");
  },
  logLevel: config.logLevel,
  corsOrigin: config.corsOrigin,
});

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await pool.end();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

await app.listen({ port: config.port, host: config.host });
