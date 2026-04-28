import express from "express";
import { env } from "./config/env.js";
import { checkDatabaseHealth, hasDatabaseConfig } from "./lib/database.js";
import { inventoryValueRouter } from "./routes/inventoryValue.js";
import { ordersRouter } from "./routes/orders.js";
import { paymentsRouter } from "./routes/payments.js";
import { productsRouter } from "./routes/products.js";

const app = express();

app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

app.get("/health", async (_req, res) => {
  const database = await checkDatabaseHealth();
  const isHealthy = database.connected || !hasDatabaseConfig;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    service: "distribution-service",
    environment: env.nodeEnv,
    port: env.port,
    timestamp: new Date().toISOString(),
    database,
  });
});

app.use("/orders", ordersRouter);
app.use("/products", productsRouter);
app.use("/inventory-value", inventoryValueRouter);
app.use("/payments", paymentsRouter);

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
    : "using Supabase REST/function fallback";
  console.log(
    `Distribution service listening on port ${env.port} (${dbMode}).`,
  );
});
