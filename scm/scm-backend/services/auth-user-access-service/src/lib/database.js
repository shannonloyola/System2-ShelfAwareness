import pg from "pg";
import { env } from "../config/env.js";
import { restHealthCheck } from "./supabaseRest.js";

const { Pool } = pg;

let pool;

export const hasSupabaseRestConfig = Boolean(
  env.supabaseUrl && (env.supabaseAnonKey || env.supabaseServiceRoleKey),
);
export const hasDatabaseConfig = Boolean(env.databaseUrl || hasSupabaseRestConfig);

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
  if (hasSupabaseRestConfig) {
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

  if (!env.databaseUrl) {
    return {
      configured: false,
      connected: false,
      message: "Identity Supabase configuration is not set",
    };
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
