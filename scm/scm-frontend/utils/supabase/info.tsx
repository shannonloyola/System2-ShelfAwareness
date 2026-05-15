/* Supabase Configuration */

const FALLBACKS = {
  identityUrl: "https://havcomxzpyywdqtpgcgr.supabase.co",
  identityAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhdmNvbXh6cHl5d2RxdHBnY2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NjkxMzYsImV4cCI6MjA5NDA0NTEzNn0.B7t9VW5kD7adMQDfW9XvrdgVuYTjEDBvpAhFsBtTuKk",
  scmUrl: "https://wbktqkjdsqrvqxxtitsg.supabase.co",
  scmAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6India3Rxa2pkc3FydnF4eHRpdHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzQ2MTIsImV4cCI6MjA5NDA1MDYxMn0.rWnlQ2PZVAWnK5kao1GPgHHexqCquzD9XE711MWOfck",
  fulfillmentUrl: "https://dkqvbyewfyzfmisyisgs.supabase.co",
  fulfillmentAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrcXZieWV3Znl6Zm1pc3lpc2dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDYzODgsImV4cCI6MjA5NDA4MjM4OH0.Xui9uAuI32CENmcaqETD4QLh7TIZYslIfJuSVUwV-iU",
  qualityUrl: "https://jbfzhlalkjbtbitvxeog.supabase.co",
  qualityAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZnpobGFsa2pidGJpdHZ4ZW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA5MDYsImV4cCI6MjA5NDA4NjkwNn0.wnzTZ78OufBxrKqR8ag7M0SDcvXzveJt1rw--a9Uv84",
  supportIntelUrl: "https://gxeqtthumaujxjbnrsqd.supabase.co",
  supportIntelAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4ZXF0dGh1bWF1anhqYm5yc3FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTcyMTQsImV4cCI6MjA5NDA3MzIxNH0.UhDc9kQ_U9Nfb-Jcc3MMNMkHnCBVkdf8jY6-x4cNg7c",
  authUserAccessServiceUrl: "http://localhost:4014",
} as const;

const trimValue = (value: string | undefined) =>
  value?.trim().replace(/^"|"$/g, "");

const readUrl = (value: string | undefined, fallback: string) =>
  trimValue(value) || fallback;

const getProjectId = (url: string) => {
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    return "";
  }
};

export const identityUrl = readUrl(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  FALLBACKS.identityUrl,
);
export const publicAnonKey =
  trimValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  FALLBACKS.identityAnonKey;

export const scmSupabaseUrl = readUrl(
  process.env.NEXT_PUBLIC_SUPABASE_SUPPLY_CHAIN_URL,
  FALLBACKS.scmUrl,
);
export const scmPublicAnonKey =
  trimValue(process.env.NEXT_PUBLIC_SUPABASE_SUPPLY_CHAIN_ANON_KEY) ||
  FALLBACKS.scmAnonKey;

export const fulfillmentSupabaseUrl = readUrl(
  process.env.NEXT_PUBLIC_SUPABASE_FULFILLMENT_URL,
  FALLBACKS.fulfillmentUrl,
);
export const fulfillmentPublicAnonKey =
  trimValue(process.env.NEXT_PUBLIC_SUPABASE_FULFILLMENT_ANON_KEY) ||
  FALLBACKS.fulfillmentAnonKey;

export const qualitySupabaseUrl = readUrl(
  process.env.NEXT_PUBLIC_SUPABASE_QUALITY_URL,
  FALLBACKS.qualityUrl,
);
export const qualityPublicAnonKey =
  trimValue(process.env.NEXT_PUBLIC_SUPABASE_QUALITY_ANON_KEY) ||
  FALLBACKS.qualityAnonKey;

export const supportIntelSupabaseUrl = readUrl(
  process.env.NEXT_PUBLIC_SUPABASE_SUPPORT_INTEL_URL,
  FALLBACKS.supportIntelUrl,
);
export const supportIntelPublicAnonKey =
  trimValue(process.env.NEXT_PUBLIC_SUPABASE_SUPPORT_INTEL_ANON_KEY) ||
  FALLBACKS.supportIntelAnonKey;

export const authUserAccessServiceUrl = readUrl(
  process.env.NEXT_PUBLIC_AUTH_USER_ACCESS_SERVICE_URL,
  FALLBACKS.authUserAccessServiceUrl,
);

export const projectId = getProjectId(identityUrl);
export const scmProjectId = getProjectId(scmSupabaseUrl);
export const fulfillmentProjectId = getProjectId(fulfillmentSupabaseUrl);
export const qualityProjectId = getProjectId(qualitySupabaseUrl);
export const supportIntelProjectId = getProjectId(supportIntelSupabaseUrl);
