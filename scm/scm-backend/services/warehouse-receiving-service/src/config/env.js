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
  nodeEnv: (process.env.NODE_ENV || "development").trim(),
  port: Number(process.env.PORT || 4005),
  databaseUrl: (process.env.DATABASE_URL || "").trim(),
  dbSsl: parseBoolean(process.env.DB_SSL, true),
  supabaseUrl: (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim(),
  supabaseAnonKey: (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim(),
  supabaseServiceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
};

// Diagnostic logging (Length only for security)
console.log(`[CONFIG] Node Env: ${env.nodeEnv}`);
console.log(`[CONFIG] Supabase URL length: ${env.supabaseUrl?.length || 0}`);
console.log(`[CONFIG] Supabase Anon Key length: ${env.supabaseAnonKey?.length || 0}`);
console.log(`[CONFIG] Supabase Service Role Key length: ${env.supabaseServiceRoleKey?.length || 0}`);

if ((env.supabaseAnonKey?.length || 0) < 10) {
  console.warn("[CONFIG] WARNING: Supabase Anon Key seems missing or too short!");
}
