import { writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const rootEnvPath = join(rootDir, ".env");
const rootExamplePath = join(rootDir, ".env.example");

// 1. Read source variables from root .env or .env.example
let envVars = {};
let sourcePath = "";

if (existsSync(rootEnvPath)) {
  sourcePath = rootEnvPath;
} else if (existsSync(rootExamplePath)) {
  sourcePath = rootExamplePath;
}

if (sourcePath) {
  console.log(`Reading source environment variables from: ${sourcePath}`);
  const content = readFileSync(sourcePath, "utf-8");
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const parts = trimmed.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let value = parts.slice(1).join("=").trim();
        // Remove enclosing quotes if any
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        envVars[key] = value;
      }
    }
  });
} else {
  console.warn("⚠️ No root .env or .env.example found! Generating envs with default values.");
}

// 2. Define service registry with their specific environment needs
const services = [
  {
    name: "scm-frontend",
    path: join(rootDir, "scm", "scm-frontend"),
    vars: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_SUPPLY_CHAIN_URL",
      "NEXT_PUBLIC_SUPABASE_SUPPLY_CHAIN_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_FULFILLMENT_URL",
      "NEXT_PUBLIC_SUPABASE_FULFILLMENT_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_QUALITY_URL",
      "NEXT_PUBLIC_SUPABASE_QUALITY_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_SUPPORT_INTEL_URL",
      "NEXT_PUBLIC_SUPABASE_SUPPORT_INTEL_ANON_KEY",
      "NEXT_PUBLIC_BACKEND_API_URL",
      "NEXT_PUBLIC_SUPPLIER_SERVICE_URL",
      "NEXT_PUBLIC_PROCUREMENT_SERVICE_URL",
      "NEXT_PUBLIC_PRODUCT_CATALOG_SERVICE_URL",
      "NEXT_PUBLIC_INVENTORY_SERVICE_URL",
      "NEXT_PUBLIC_WAREHOUSE_RECEIVING_SERVICE_URL",
      "NEXT_PUBLIC_DISTRIBUTION_SERVICE_URL",
      "NEXT_PUBLIC_DISCREPANCY_QC_SERVICE_URL",
      "NEXT_PUBLIC_STOCK_ADJUSTMENT_SERVICE_URL",
      "NEXT_PUBLIC_AUTH_USER_ACCESS_SERVICE_URL",
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY"
    ]
  },
  {
    name: "scm-backend-gateway",
    path: join(rootDir, "scm", "scm-backend", "backend"),
    vars: [
      "NODE_ENV",
      "PORT",
      "DATABASE_URL",
      "DB_SSL",
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPPLIER_SERVICE_URL",
      "PROCUREMENT_SERVICE_URL",
      "PRODUCT_CATALOG_SERVICE_URL",
      "INVENTORY_SERVICE_URL",
      "WAREHOUSE_RECEIVING_SERVICE_URL",
      "DISTRIBUTION_SERVICE_URL",
      "DISCREPANCY_QC_SERVICE_URL",
      "STOCK_ADJUSTMENT_SERVICE_URL",
      "CYCLE_COUNTING_SERVICE_URL",
      "RISK_COMPLIANCE_SERVICE_URL",
      "NOTIFICATION_SERVICE_URL",
      "REPORTING_ANALYTICS_SERVICE_URL",
      "DOCUMENT_SERVICE_URL",
      "AUTH_USER_ACCESS_SERVICE_URL"
    ]
  }
];

// Add microservices dynamically from directory
const servicesDir = join(rootDir, "scm", "scm-backend", "services");
const microservicePorts = {
  "supplier-service": 4001,
  "procurement-service": 4002,
  "product-catalog-service": 4003,
  "inventory-service": 4004,
  "warehouse-receiving-service": 4005,
  "distribution-service": 4006,
  "discrepancy-qc-service": 4007,
  "stock-adjustment-service": 4008,
  "cycle-counting-service": 4009,
  "risk-compliance-service": 4010,
  "notification-service": 4011,
  "reporting-analytics-service": 4012,
  "document-service": 4013,
  "auth-user-access-service": 4014
};

if (existsSync(servicesDir)) {
  const dirs = readdirSync(servicesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  for (const name of dirs) {
    const servicePath = join(servicesDir, name);
    if (existsSync(join(servicePath, "package.json"))) {
      const port = microservicePorts[name] || 4000;
      
      // Determine scoped variables based on service type
      let vars = ["NODE_ENV", "PORT", "DB_SSL", "CRON_TIMEZONE"];
      
      // Supply Chain services (SCM DB)
      if (["supplier-service", "procurement-service", "product-catalog-service"].includes(name)) {
        vars.push(
          "SUPABASE_SUPPLY_CHAIN_DATABASE_URL", 
          "SCM_DATABASE_URL",
          "NEXT_PUBLIC_SUPABASE_SUPPLY_CHAIN_URL",
          "NEXT_PUBLIC_SUPABASE_SUPPLY_CHAIN_ANON_KEY",
          "SUPABASE_SUPPLY_CHAIN_SERVICE_ROLE_KEY",
          "SCM_SUPABASE_SERVICE_ROLE_KEY",
          "SUPABASE_SERVICE_ROLE_KEY",
          "DOMAIN4_SUPABASE_URL",
          "DOMAIN4_SUPABASE_ANON_KEY"
        );
      }
      
      // Fulfillment services (Fulfillment DB)
      if (["inventory-service", "warehouse-receiving-service", "distribution-service", "stock-adjustment-service", "cycle-counting-service"].includes(name)) {
        vars.push(
          "SUPABASE_FULFILLMENT_DATABASE_URL",
          "FULFILLMENT_DATABASE_URL",
          "NEXT_PUBLIC_SUPABASE_URL",
          "NEXT_PUBLIC_SUPABASE_ANON_KEY",
          "NEXT_PUBLIC_SUPABASE_SUPPLY_CHAIN_URL",
          "NEXT_PUBLIC_SUPABASE_SUPPLY_CHAIN_ANON_KEY",
          "NEXT_PUBLIC_SUPABASE_FULFILLMENT_URL",
          "NEXT_PUBLIC_SUPABASE_FULFILLMENT_ANON_KEY",
          "SUPABASE_FULFILLMENT_SERVICE_ROLE_KEY"
        );
      }

      // Quality & Compliance services (Quality DB)
      if (["discrepancy-qc-service", "risk-compliance-service"].includes(name)) {
        vars.push(
          "DOMAIN4_SUPABASE_URL",
          "DOMAIN4_SUPABASE_ANON_KEY",
          "NEXT_PUBLIC_SUPABASE_QUALITY_URL",
          "NEXT_PUBLIC_SUPABASE_QUALITY_ANON_KEY"
        );
      }

      // Reporting/Analytics & Document services (Intelligence DB)
      if (["reporting-analytics-service", "document-service"].includes(name)) {
        vars.push(
          "SUPABASE_SUPPORT_INTEL_DATABASE_URL",
          "DOMAIN5_DATABASE_URL",
          "DOMAIN5_SUPABASE_URL",
          "NEXT_PUBLIC_SUPABASE_SUPPORT_INTEL_URL",
          "DOMAIN5_SUPABASE_ANON_KEY",
          "NEXT_PUBLIC_SUPABASE_SUPPORT_INTEL_ANON_KEY",
          "INVENTORY_SERVICE_URL",
          "PRODUCT_CATALOG_SERVICE_URL",
          "PROCUREMENT_SERVICE_URL",
          "DISTRIBUTION_SERVICE_URL",
          "SUPPLIER_SERVICE_URL",
          "CYCLE_COUNTING_SERVICE_URL",
          "NEXT_PUBLIC_INVENTORY_SERVICE_URL",
          "NEXT_PUBLIC_PRODUCT_CATALOG_SERVICE_URL",
          "NEXT_PUBLIC_PROCUREMENT_SERVICE_URL",
          "NEXT_PUBLIC_DISTRIBUTION_SERVICE_URL",
          "NEXT_PUBLIC_SUPPLIER_SERVICE_URL",
          "NEXT_PUBLIC_CYCLE_COUNTING_SERVICE_URL"
        );
      }

      // Auth & Notification services
      if (["auth-user-access-service", "notification-service"].includes(name)) {
        vars.push(
          "SUPABASE_URL",
          "SUPABASE_ANON_KEY",
          "SUPABASE_SERVICE_ROLE_KEY",
          "NEXT_PUBLIC_SUPABASE_URL",
          "NEXT_PUBLIC_SUPABASE_ANON_KEY",
          "NEXT_PUBLIC_SUPABASE_SUPPLY_CHAIN_URL",
          "NEXT_PUBLIC_SUPABASE_SUPPLY_CHAIN_ANON_KEY",
          "NEXT_PUBLIC_SUPABASE_FULFILLMENT_URL",
          "NEXT_PUBLIC_SUPABASE_FULFILLMENT_ANON_KEY"
        );
      }

      services.push({
        name,
        path: servicePath,
        port,
        vars
      });
    }
  }
}

// 3. Write scoped environment files
console.log(`\nGenerating specific environment configurations for all services...`);
for (const service of services) {
  let lines = [`# Scoped environment variables for ${service.name}`, ""];
  
  if (service.port) {
    lines.push(`PORT=${service.port}`);
  }

  for (const key of service.vars) {
    // Avoid double writing PORT
    if (key === "PORT" && service.port) continue;

    let val = envVars[key] || "";
    
    // Provide sensible default fallback values
    if (val === "" && key === "NODE_ENV") val = "development";
    if (val === "" && key === "DB_SSL") val = "true";
    if (val === "" && key === "CRON_TIMEZONE") val = "Asia/Manila";
    if (val === "" && key.endsWith("_SERVICE_URL") && service.port) {
      // Local internal URL fallback
      const serviceName = key.replace("_SERVICE_URL", "").toLowerCase().replace(/_/g, "-");
      if (microservicePorts[serviceName]) {
        val = `http://localhost:${microservicePorts[serviceName]}`;
      }
    }

    lines.push(`${key}=${val}`);
  }

  const envContent = lines.join("\n") + "\n";
  const outputPath = join(service.path, ".env");
  
  try {
    writeFileSync(outputPath, envContent, "utf-8");
    console.log(` - Created scoped .env at: ${service.path}`);
  } catch (err) {
    console.error(`Failed to create env for ${service.name}:`, err);
  }
}

console.log("\nAll scoped .env files successfully generated and aligned!");
