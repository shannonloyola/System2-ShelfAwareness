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
  port: Number(process.env.SCM_AUTH_USER_ACCESS_PORT || 3026),
  databaseUrl:
    process.env.SCM_AUTH_USER_ACCESS_IDENTITY_DATABASE_URL ||
    process.env.SCM_AUTH_USER_ACCESS_SUPABASE_IDENTITY_DATABASE_URL ||
    "",
  dbSsl: parseBoolean(process.env.SCM_AUTH_USER_ACCESS_DB_SSL, true),

  // Identity project
  supabaseUrl: (
    process.env.SCM_AUTH_USER_ACCESS_IDENTITY_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SCM_AUTH_USER_ACCESS_SUPABASE_URL ||
    ""
  ).trim(),
  supabaseAnonKey: (
    process.env.SCM_AUTH_USER_ACCESS_IDENTITY_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SCM_AUTH_USER_ACCESS_SUPABASE_ANON_KEY ||
    ""
  ).trim(),
  supabaseServiceRoleKey: (
    process.env.SCM_AUTH_USER_ACCESS_IDENTITY_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SCM_AUTH_USER_ACCESS_SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim(),

  // Supply-chain project
  scmSupabaseUrl: (
    process.env.NEXT_PUBLIC_SCM_AUTH_USER_ACCESS_SUPABASE_SUPPLY_CHAIN_URL ||
    "https://wbktqkjdsqrvqxxtitsg.supabase.co"
  ).trim(),
  scmSupabaseAnonKey: (
    process.env.NEXT_PUBLIC_SCM_AUTH_USER_ACCESS_SUPABASE_SUPPLY_CHAIN_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6India3Rxa2pkc3FydnF4eHRpdHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzQ2MTIsImV4cCI6MjA5NDA1MDYxMn0.rWnlQ2PZVAWnK5kao1GPgHHexqCquzD9XE711MWOfck"
  ).trim(),
};
