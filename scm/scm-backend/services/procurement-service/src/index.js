import express from "express";
import { env } from "./config/env.js";
import { checkDatabaseHealth, hasDatabaseConfig } from "./lib/database.js";
import { purchaseOrdersRouter } from "./routes/purchaseOrders.js";

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

app.get("/health", async (_req, res) => {
  const database = await checkDatabaseHealth();
  res.status(200).json({
    status: "ok",
    service: "procurement-service",
    timestamp: new Date().toISOString(),
    database: {
      connected: database.connected,
      configured: hasDatabaseConfig,
      message: database.message ? database.message.replace(/:.*@/, ":****@") : null,
    },
  });
});

app.use("/purchase-orders", purchaseOrdersRouter);

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  const message = error.message || "Internal server error";

  res.status(status).json({
    error: message,
    details: error.details ?? null,
  });
});

app.listen(env.port, () => {
  const dbMode = hasDatabaseConfig
    ? "postgres configured"
    : "using Supabase REST fallback";
  console.log(`Procurement service listening on port ${env.port} (${dbMode}).`);
});
