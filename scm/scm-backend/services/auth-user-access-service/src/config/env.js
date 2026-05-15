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
  port: Number(process.env.PORT || 4014),
  databaseUrl:
    process.env.IDENTITY_DATABASE_URL ||
    process.env.SUPABASE_IDENTITY_DATABASE_URL ||
    "",
  dbSsl: parseBoolean(process.env.DB_SSL, true),

  // Identity project
  supabaseUrl: (
    process.env.IDENTITY_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim(),
  supabaseAnonKey: (
    process.env.IDENTITY_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim(),
  supabaseServiceRoleKey: (
    process.env.IDENTITY_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim(),

  // Supply-chain project
  scmSupabaseUrl: (
    process.env.NEXT_PUBLIC_SUPABASE_SUPPLY_CHAIN_URL ||
    "https://wbktqkjdsqrvqxxtitsg.supabase.co"
  ).trim(),
  scmSupabaseAnonKey: (
    process.env.NEXT_PUBLIC_SUPABASE_SUPPLY_CHAIN_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6India3Rxa2pkc3FydnF4eHRpdHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzQ2MTIsImV4cCI6MjA5NDA1MDYxMn0.rWnlQ2PZVAWnK5kao1GPgHHexqCquzD9XE711MWOfck"
  ).trim(),
};
