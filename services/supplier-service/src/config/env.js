import dotenv from "dotenv";

dotenv.config();

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === "") {
    return fallback;
  }

  return value.toLowerCase() === "true";
};

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4001),
  databaseUrl: process.env.DATABASE_URL || "",
  dbSsl: parseBoolean(process.env.DB_SSL, true),
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  cronTimezone: process.env.CRON_TIMEZONE || "Asia/Manila",
};
