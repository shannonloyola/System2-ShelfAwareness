import express from "express";
import { env } from "./config/env.js";
import { checkDatabaseHealth, hasDatabaseConfig } from "./lib/database.js";
import { suppliersRouter } from "./routes/suppliers.js";
import { supplierScorecardsRouter } from "./routes/supplierScorecards.js";
import { scorecardJobsRouter } from "./routes/scorecardJobs.js";
import { startMonthlyScorecardScheduler } from "./lib/scheduler.js";

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

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
    service: "supplier-service",
    timestamp: new Date().toISOString(),
    database: {
      connected: database.connected,
      configured: hasDatabaseConfig,
      message: database.message ? database.message.replace(/:.*@/, ":****@") : null,
    },
  });
});

app.use("/suppliers", suppliersRouter);
app.use("/supplier-scorecards", supplierScorecardsRouter);
app.use("/scorecard-jobs", scorecardJobsRouter);

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  const message =
    error.message || "Internal server error";

  res.status(status).json({
    error: message,
    details: error.details ?? null,
  });
});

app.listen(env.port, () => {
  const dbMode = hasDatabaseConfig
    ? "postgres configured"
    : "using Supabase REST fallback";
  console.log(`Supplier service listening on port ${env.port} (${dbMode}).`);
});

startMonthlyScorecardScheduler();
