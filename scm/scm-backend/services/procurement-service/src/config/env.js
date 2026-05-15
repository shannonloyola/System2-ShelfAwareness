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
  port: Number(process.env.PORT || 4002),
  databaseUrl:
    process.env.SUPABASE_SUPPLY_CHAIN_DATABASE_URL ||
    process.env.SCM_DATABASE_URL ||
    "",
  dbSsl: parseBoolean(process.env.DB_SSL, true),
  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_SUPPLY_CHAIN_URL ||
    "",
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_SUPPLY_CHAIN_ANON_KEY ||
    "",
};
