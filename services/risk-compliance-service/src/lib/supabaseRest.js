import { env } from "../config/env.js";

const buildHeaders = () => ({
  apikey: env.supabaseAnonKey,
  Authorization: `Bearer ${env.supabaseAnonKey}`,
  "Content-Type": "application/json",
});

export const restHealthCheck = async () => {
  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/suppliers?select=supplier_name&limit=1`,
    {
      method: "GET",
      headers: buildHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase REST health check failed with ${response.status}`);
  }
};
