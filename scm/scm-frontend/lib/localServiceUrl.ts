const localServicePorts: Record<string, number> = {
  "pharma-backend": 3001,
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
  "auth-user-access-service": 4014,
};

export const localizeServiceUrl = (value: string | undefined, fallback: string) => {
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
