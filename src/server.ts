import app from "./app.js";
import { pool } from "./config/database.js";
import { assertJwtConfiguration } from "./utils/jwt.js";

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

async function startServer() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be configured.");
  assertJwtConfiguration();
  await pool.query("SELECT 1");

  const server = app.listen(port, () => {
    console.log(`Todo List API listening on port ${port}`);
  });

  const shutdown = () => {
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startServer().catch(async (error: unknown) => {
  console.error("Failed to start the API", error);
  await pool.end();
  process.exitCode = 1;
});
