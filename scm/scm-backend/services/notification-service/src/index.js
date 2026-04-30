import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { checkDatabaseHealth, hasDatabaseConfig } from "./lib/database.js";
import { notificationsRouter } from "./routes/notifications.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  const database = await checkDatabaseHealth();
  res.status(200).json({
    status: "ok",
    service: "notification-service",
    timestamp: new Date().toISOString(),
    database: {
      connected: database.connected,
      configured: hasDatabaseConfig,
      message: database.message ? database.message.replace(/:.*@/, ":****@") : null,
    },
  });
});

app.use("/notifications", notificationsRouter);

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  const message = error.message || "Internal server error";

  console.error(`[Error] ${status} - ${message}`, error.details || "");

  res.status(status).json({
    error: message,
    details: error.details ?? null,
  });
});

app.listen(env.port, () => {
  const dbMode = hasDatabaseConfig
    ? "postgres configured"
    : "using Supabase REST fallback";
  console.log(
    `Notification service listening on port ${env.port} (${dbMode}).`,
  );
});
