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
  port: Number(process.env.SCM_RISK_COMPLIANCE_PORT || 4010),
  databaseUrl:
    process.env.SCM_RISK_COMPLIANCE_SUPABASE_QUALITY_DATABASE_URL ||
    process.env.SCM_RISK_COMPLIANCE_DOMAIN4_DATABASE_URL ||
    "",
  dbSsl: parseBoolean(process.env.SCM_RISK_COMPLIANCE_DB_SSL, true),
  supabaseUrl:
    process.env.SCM_RISK_COMPLIANCE_DOMAIN4_SUPABASE_URL ||
    "",
  supabaseAnonKey:
    process.env.SCM_RISK_COMPLIANCE_DOMAIN4_SUPABASE_ANON_KEY ||
    "",
  scmSupabaseUrl:
    process.env.NEXT_PUBLIC_SCM_RISK_COMPLIANCE_SUPABASE_SUPPLY_CHAIN_URL ||
    "",
  scmSupabaseAnonKey:
    process.env.NEXT_PUBLIC_SCM_RISK_COMPLIANCE_SUPABASE_SUPPLY_CHAIN_ANON_KEY ||
    "",
  cronTimezone: process.env.SCM_RISK_COMPLIANCE_CRON_TIMEZONE || "Asia/Manila",
};
