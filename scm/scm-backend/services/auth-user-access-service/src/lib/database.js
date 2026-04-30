import pg from "pg";
import { env } from "../config/env.js";
import { restHealthCheck } from "./supabaseRest.js";

const { Pool } = pg;

let pool;

export const hasDatabaseConfig = Boolean(env.databaseUrl);
export const hasSupabaseRestConfig = Boolean(
  env.supabaseUrl && env.supabaseAnonKey,
);

export const getPool = () => {
  if (!hasDatabaseConfig) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: env.databaseUrl,
      ssl: env.dbSsl ? { rejectUnauthorized: false } : false,
    });
  }

  return pool;
};

export const checkDatabaseHealth = async () => {
  if (!hasDatabaseConfig) {
    if (!hasSupabaseRestConfig) {
      return {
        configured: false,
        connected: false,
        message: "DATABASE_URL is not set",
      };
    }

    try {
      await restHealthCheck();
      return {
        configured: true,
        connected: true,
        message: "Supabase REST connection is healthy",
        mode: "supabase-rest",
      };
    } catch (error) {
      return {
        configured: true,
        connected: false,
        message:
          error instanceof Error
            ? error.message
            : "Supabase REST health check failed",
        mode: "supabase-rest",
      };
    }
  }

  try {
    const activePool = getPool();
    await activePool.query("SELECT 1");
    return {
      configured: true,
      connected: true,
      message: "Database connection is healthy",
      mode: "postgres",
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      message:
        error instanceof Error
          ? error.message
          : "Database health check failed",
      mode: "postgres",
    };
  }
};
