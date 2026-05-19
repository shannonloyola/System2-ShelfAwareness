import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const loadFallbackEnv = () => {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "..", "..", ".env"),
    path.resolve(process.cwd(), "..", "..", "..", ".env"),
    path.resolve(process.cwd(), "..", "..", "..", "..", ".env"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate, override: false });
    }
  }
};

loadFallbackEnv();

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === "") {
    return fallback;
  }

  return value.toLowerCase() === "true";
};

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.SCM_NOTIFICATION_PORT || 3023),
  databaseUrl:
    process.env.SCM_NOTIFICATION_SUPABASE_SUPPORT_INTEL_DATABASE_URL ||
    process.env.SCM_NOTIFICATION_DOMAIN5_DATABASE_URL ||
    "",
  dbSsl: parseBoolean(process.env.SCM_NOTIFICATION_DB_SSL, true),
  supabaseUrl:
    process.env.SCM_NOTIFICATION_DOMAIN5_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SCM_NOTIFICATION_SUPABASE_SUPPORT_INTEL_URL ||
    "",
  supabaseAnonKey:
    process.env.SCM_NOTIFICATION_DOMAIN5_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SCM_NOTIFICATION_SUPABASE_SUPPORT_INTEL_ANON_KEY ||
    "",
};
