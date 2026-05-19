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

const localServicePorts = {
  "supplier-service": 4001,
  "procurement-service": 4002,
  "product-catalog-service": 4003,
  "inventory-service": 4004,
  "warehouse-receiving-service": 4005,
  "distribution-service": 4006,
  "discrepancy-qc-service": 4007,
  "stock-adjustment-service": 4008,
  "cycle-counting-service": 4009,
};

const localizeServiceUrl = (value, fallback) => {
  const rawValue = value?.trim().replace(/^"|"$/g, "");
  if (!rawValue || !rawValue.startsWith("http")) {
    return fallback;
  }

  try {
    const url = new URL(rawValue);
    const localPort = localServicePorts[url.hostname];
    if (localPort) {
      url.hostname = "localhost";
      url.port = String(localPort);
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    return fallback;
  }

  return rawValue.replace(/\/$/, "");
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
  inventoryServiceUrl: localizeServiceUrl(
    process.env.INVENTORY_SERVICE_URL ||
      process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL,
    "http://localhost:4004",
  ),
  productCatalogServiceUrl: localizeServiceUrl(
    process.env.PRODUCT_CATALOG_SERVICE_URL ||
      process.env.NEXT_PUBLIC_PRODUCT_CATALOG_SERVICE_URL,
    "http://localhost:4003",
  ),
  procurementServiceUrl: localizeServiceUrl(
    process.env.PROCUREMENT_SERVICE_URL ||
      process.env.NEXT_PUBLIC_PROCUREMENT_SERVICE_URL,
    "http://localhost:4002",
  ),
  distributionServiceUrl: localizeServiceUrl(
    process.env.DISTRIBUTION_SERVICE_URL ||
      process.env.NEXT_PUBLIC_DISTRIBUTION_SERVICE_URL,
    "http://localhost:4006",
  ),
  supplierServiceUrl: localizeServiceUrl(
    process.env.SUPPLIER_SERVICE_URL ||
      process.env.NEXT_PUBLIC_SUPPLIER_SERVICE_URL,
    "http://localhost:4001",
  ),
  cycleCountingServiceUrl: localizeServiceUrl(
    process.env.CYCLE_COUNTING_SERVICE_URL ||
      process.env.NEXT_PUBLIC_CYCLE_COUNTING_SERVICE_URL,
    "http://localhost:4009",
  ),
};
