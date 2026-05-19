import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";

const npmCmd = "npm";

const localServiceEnv = {
  NEXT_PUBLIC_SUPPLIER_SERVICE_URL: "http://localhost:4001",
  NEXT_PUBLIC_PROCUREMENT_SERVICE_URL: "http://localhost:4002",
  NEXT_PUBLIC_PRODUCT_CATALOG_SERVICE_URL: "http://localhost:4003",
  NEXT_PUBLIC_INVENTORY_SERVICE_URL: "http://localhost:4004",
  NEXT_PUBLIC_WAREHOUSE_RECEIVING_SERVICE_URL: "http://localhost:4005",
  NEXT_PUBLIC_DISTRIBUTION_SERVICE_URL: "http://localhost:4006",
  NEXT_PUBLIC_DISCREPANCY_QC_SERVICE_URL: "http://localhost:4007",
  NEXT_PUBLIC_STOCK_ADJUSTMENT_SERVICE_URL: "http://localhost:4008",
  NEXT_PUBLIC_CYCLE_COUNTING_SERVICE_URL: "http://localhost:4009",
  NEXT_PUBLIC_RISK_COMPLIANCE_SERVICE_URL: "http://localhost:4010",
  NEXT_PUBLIC_NOTIFICATION_SERVICE_URL: "http://localhost:4011",
  NEXT_PUBLIC_REPORTING_ANALYTICS_SERVICE_URL: "http://localhost:4012",
  NEXT_PUBLIC_DOCUMENT_SERVICE_URL: "http://localhost:4013",
  NEXT_PUBLIC_AUTH_USER_ACCESS_SERVICE_URL: "http://localhost:4014",
};

const localInternalServiceEnv = {
  SUPPLIER_SERVICE_URL: "http://localhost:4001",
  PROCUREMENT_SERVICE_URL: "http://localhost:4002",
  PRODUCT_CATALOG_SERVICE_URL: "http://localhost:4003",
  INVENTORY_SERVICE_URL: "http://localhost:4004",
  WAREHOUSE_RECEIVING_SERVICE_URL: "http://localhost:4005",
  DISTRIBUTION_SERVICE_URL: "http://localhost:4006",
  DISCREPANCY_QC_SERVICE_URL: "http://localhost:4007",
  STOCK_ADJUSTMENT_SERVICE_URL: "http://localhost:4008",
  CYCLE_COUNTING_SERVICE_URL: "http://localhost:4009",
  RISK_COMPLIANCE_SERVICE_URL: "http://localhost:4010",
  NOTIFICATION_SERVICE_URL: "http://localhost:4011",
  REPORTING_ANALYTICS_SERVICE_URL: "http://localhost:4012",
  DOCUMENT_SERVICE_URL: "http://localhost:4013",
  AUTH_USER_ACCESS_SERVICE_URL: "http://localhost:4014",
};

const serviceCandidates = [
  {
    name: "frontend",
    cwd: "scm/scm-frontend",
    args: ["run", "dev", "--", "--port", "5173"],
    env: localServiceEnv,
  },
  {
    name: "backend",
    cwd: "scm/scm-backend/backend",
    args: ["run", "start"],
    requiredPath: "scm/scm-backend/backend/node_modules/.bin/nest",
    skipMessage:
      "Skipping backend because Nest dependencies are not installed yet. Run `npm run install:backend` once, then `npm run dev` again.",
  },
  {
    name: "supplier-service",
    cwd: "scm/scm-backend/services/supplier-service",
    args: ["run", "start"],
  },
  {
    name: "procurement-service",
    cwd: "scm/scm-backend/services/procurement-service",
    args: ["run", "start"],
  },
  {
    name: "product-catalog-service",
    cwd: "scm/scm-backend/services/product-catalog-service",
    args: ["run", "start"],
  },
  {
    name: "inventory-service",
    cwd: "scm/scm-backend/services/inventory-service",
    args: ["run", "start"],
  },
  {
    name: "warehouse-receiving-service",
    cwd: "scm/scm-backend/services/warehouse-receiving-service",
    args: ["run", "start"],
  },
  {
    name: "distribution-service",
    cwd: "scm/scm-backend/services/distribution-service",
    args: ["run", "start"],
  },
  {
    name: "discrepancy-qc-service",
    cwd: "scm/scm-backend/services/discrepancy-qc-service",
    args: ["run", "start"],
  },
  {
    name: "stock-adjustment-service",
    cwd: "scm/scm-backend/services/stock-adjustment-service",
    args: ["run", "start"],
  },
  {
    name: "cycle-counting-service",
    cwd: "scm/scm-backend/services/cycle-counting-service",
    args: ["run", "start"],
  },
  {
    name: "risk-compliance-service",
    cwd: "scm/scm-backend/services/risk-compliance-service",
    args: ["run", "start"],
  },
  {
    name: "notification-service",
    cwd: "scm/scm-backend/services/notification-service",
    args: ["run", "start"],
  },
  {
    name: "reporting-analytics-service",
    cwd: "scm/scm-backend/services/reporting-analytics-service",
    args: ["run", "start"],
    env: localInternalServiceEnv,
  },
  {
    name: "document-service",
    cwd: "scm/scm-backend/services/document-service",
    args: ["run", "start"],
  },
  {
    name: "auth-user-access-service",
    cwd: "scm/scm-backend/services/auth-user-access-service",
    args: ["run", "start"],
  },
];

const services = serviceCandidates.filter((service) => {
  if (!service.requiredPath) {
    return true;
  }

  if (existsSync(service.requiredPath)) {
    return true;
  }

  process.stderr.write(`[${service.name}] ${service.skipMessage}\n`);
  return false;
});

const children = [];
let shuttingDown = false;

const prefixOutput = (name, colorCode, data, stream) => {
  const text = data.toString();
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    stream.write(`\x1b[${colorCode}m[${name}]\x1b[0m ${line}\n`);
  }
};

const terminateChildTree = async (pid) => {
  if (!pid) return;

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.on("exit", resolve);
      killer.on("error", resolve);
    });
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // ignore cleanup failures
  }
};

const shutdown = async (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  process.stdout.write("\nShutting down dev stack...\n");
  await Promise.all(children.map((child) => terminateChildTree(child.pid)));
  process.exit(exitCode);
};

process.on("SIGINT", () => {
  void shutdown(0);
});

process.on("SIGTERM", () => {
  void shutdown(0);
});

const colors = [36, 35, 33, 32, 34, 91, 92, 93, 94, 95, 96];

services.forEach((service, index) => {
  const child = spawn(npmCmd, service.args, {
    cwd: service.cwd,
    env: { ...process.env, ...(service.env ?? {}) },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    windowsHide: true,
    detached: process.platform !== "win32",
  });

  const color = colors[index % colors.length];
  child.stdout.on("data", (data) =>
    prefixOutput(service.name, color, data, process.stdout),
  );
  child.stderr.on("data", (data) =>
    prefixOutput(service.name, color, data, process.stderr),
  );

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const details = signal
      ? `signal ${signal}`
      : `code ${code ?? "unknown"}`;
    process.stderr.write(
      `\n[${service.name}] exited unexpectedly with ${details}.\n`,
    );
    void shutdown(code ?? 1);
  });

  child.on("error", (error) => {
    if (shuttingDown) return;
    process.stderr.write(
      `\n[${service.name}] failed to start: ${error.message}\n`,
    );
    void shutdown(1);
  });

  children.push(child);
});

process.stdout.write(
  "Starting SCM dev stack on frontend port 5173 with backend and microservices...\n",
);
