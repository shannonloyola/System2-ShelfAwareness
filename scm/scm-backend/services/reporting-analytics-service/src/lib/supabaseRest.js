import { env } from "../config/env.js";

const buildHeaders = () => ({
  apikey: env.supabaseAnonKey,
  Authorization: `Bearer ${env.supabaseAnonKey}`,
  "Content-Type": "application/json",
});

const ensureRestConfig = () => {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY is not set");
  }
};

export const restHealthCheck = async () => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/health_check_dummy?select=*&limit=1`,
    {
      method: "GET",
      headers: buildHeaders(),
    },
  ).catch(() => ({ ok: false, status: 500 }));

  if (!response.ok && response.status !== 404) {
    throw new Error(`Supabase REST health check failed with ${response.status}`);
  }
};
