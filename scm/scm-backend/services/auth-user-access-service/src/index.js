import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { checkDatabaseHealth, hasDatabaseConfig } from "./lib/database.js";
import { authRouter } from "./routes/auth.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  const database = await checkDatabaseHealth();
  res.status(200).json({
    status: "ok",
    service: "auth-user-access-service",
    timestamp: new Date().toISOString(),
    database: {
      connected: database.connected,
      configured: hasDatabaseConfig,
      message: database.message ? database.message.replace(/:.*@/, ":****@") : null,
    },
  });
});

app.use("/auth", authRouter);

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  const message = error.message || "Internal server error";

  console.error(`[Auth Error] ${status} - ${message}`);

  res.status(status).json({
    error: message,
    details: error.details ?? null,
  });
});

app.listen(env.port, () => {
  console.log(`Auth & User Access service listening on port ${env.port}.`);
});
