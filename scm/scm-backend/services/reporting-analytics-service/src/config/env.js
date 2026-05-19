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
  port: Number(process.env.SCM_REPORTING_ANALYTICS_PORT || 3024),
  databaseUrl:
    process.env.SCM_REPORTING_ANALYTICS_SUPABASE_SUPPORT_INTEL_DATABASE_URL ||
    process.env.SCM_REPORTING_ANALYTICS_DOMAIN5_DATABASE_URL ||
    "",
  dbSsl: parseBoolean(process.env.SCM_REPORTING_ANALYTICS_DB_SSL, true),
  supabaseUrl:
    process.env.SCM_REPORTING_ANALYTICS_DOMAIN5_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SCM_REPORTING_ANALYTICS_SUPABASE_SUPPORT_INTEL_URL ||
    "",
  supabaseAnonKey:
    process.env.SCM_REPORTING_ANALYTICS_DOMAIN5_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SCM_REPORTING_ANALYTICS_SUPABASE_SUPPORT_INTEL_ANON_KEY ||
    "",
  inventoryServiceUrl:
    process.env.SCM_REPORTING_ANALYTICS_INVENTORY_SERVICE_URL ||
    process.env.NEXT_PUBLIC_SCM_REPORTING_ANALYTICS_INVENTORY_SERVICE_URL ||
    "http://localhost:4004",
  productCatalogServiceUrl:
    process.env.SCM_REPORTING_ANALYTICS_PRODUCT_CATALOG_SERVICE_URL ||
    process.env.NEXT_PUBLIC_SCM_REPORTING_ANALYTICS_PRODUCT_CATALOG_SERVICE_URL ||
    "http://localhost:4003",
  procurementServiceUrl:
    process.env.SCM_REPORTING_ANALYTICS_PROCUREMENT_SERVICE_URL ||
    process.env.NEXT_PUBLIC_SCM_REPORTING_ANALYTICS_PROCUREMENT_SERVICE_URL ||
    "http://localhost:4002",
  distributionServiceUrl:
    process.env.SCM_REPORTING_ANALYTICS_DISTRIBUTION_SERVICE_URL ||
    process.env.NEXT_PUBLIC_SCM_REPORTING_ANALYTICS_DISTRIBUTION_SERVICE_URL ||
    "http://localhost:4006",
  supplierServiceUrl:
    process.env.SCM_REPORTING_ANALYTICS_SUPPLIER_SERVICE_URL ||
    process.env.NEXT_PUBLIC_SCM_REPORTING_ANALYTICS_SUPPLIER_SERVICE_URL ||
    "http://localhost:4001",
  cycleCountingServiceUrl:
    process.env.SCM_REPORTING_ANALYTICS_CYCLE_COUNTING_SERVICE_URL ||
    process.env.NEXT_PUBLIC_SCM_REPORTING_ANALYTICS_CYCLE_COUNTING_SERVICE_URL ||
    "http://localhost:4009",
};
