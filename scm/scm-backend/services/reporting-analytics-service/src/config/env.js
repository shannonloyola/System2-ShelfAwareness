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
  port: Number(process.env.PORT || 4012),
  databaseUrl:
    process.env.SUPABASE_SUPPORT_INTEL_DATABASE_URL ||
    process.env.DOMAIN5_DATABASE_URL ||
    "",
  dbSsl: parseBoolean(process.env.DB_SSL, true),
  supabaseUrl:
    process.env.DOMAIN5_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_SUPPORT_INTEL_URL ||
    "",
  supabaseAnonKey:
    process.env.DOMAIN5_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SUPPORT_INTEL_ANON_KEY ||
    "",
  inventoryServiceUrl:
    process.env.INVENTORY_SERVICE_URL ||
    process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL ||
    "http://localhost:4004",
  productCatalogServiceUrl:
    process.env.PRODUCT_CATALOG_SERVICE_URL ||
    process.env.NEXT_PUBLIC_PRODUCT_CATALOG_SERVICE_URL ||
    "http://localhost:4003",
  procurementServiceUrl:
    process.env.PROCUREMENT_SERVICE_URL ||
    process.env.NEXT_PUBLIC_PROCUREMENT_SERVICE_URL ||
    "http://localhost:4002",
  distributionServiceUrl:
    process.env.DISTRIBUTION_SERVICE_URL ||
    process.env.NEXT_PUBLIC_DISTRIBUTION_SERVICE_URL ||
    "http://localhost:4006",
  supplierServiceUrl:
    process.env.SUPPLIER_SERVICE_URL ||
    process.env.NEXT_PUBLIC_SUPPLIER_SERVICE_URL ||
    "http://localhost:4001",
  cycleCountingServiceUrl:
    process.env.CYCLE_COUNTING_SERVICE_URL ||
    process.env.NEXT_PUBLIC_CYCLE_COUNTING_SERVICE_URL ||
    "http://localhost:4009",
};
