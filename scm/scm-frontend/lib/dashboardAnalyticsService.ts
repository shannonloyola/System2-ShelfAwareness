import type { DashboardRole } from "@/store/dashboardStore";

export type DashboardKpi = {
  label: string;
  value: string;
  delta: number;
  inverseGood?: boolean;
  trend: number[];
  subLabel?: string;
};

export type InventoryValuationPoint = {
  date: string;
  value: number;
  category?: string;
  isAnomaly?: boolean;
};

export type CriticalStockProduct = {
  sku: string;
  name: string;
  category: string;
  stockLevel: number;
  reservedStock?: number;
  dailyMovement?: number | null;
  daysOfCover?: number | null;
  value: number;
  status: string;
};

export type BudgetPosition = {
  allocated: number;
  spent: number;
  committed: number;
  remaining: number;
  usedPct: number;
  categories: Array<{
    category: string;
    allocated: number;
    spent: number;
    committed: number;
  }>;
};

export type TopExposureProduct = {
  rank: number;
  sku: string;
  name: string;
  category: string;
  exposure: number;
  trend: number[];
  budgetUtilizationPct: number;
  budgetRemaining: number;
};

export type StockMovementEvent = {
  id: string;
  timestamp: string;
  type: "TRANSFER" | "ADJUSTMENT" | "RECEIVING" | "DISPATCH" | "CYCLE_COUNT";
  severity: "info" | "warning" | "critical";
  sku: string;
  productName: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  unit: string;
  triggeredBy: string;
  status: string;
};

export type WarehouseBin = {
  zone: string;
  aisle: string;
  bin: string;
  capacity: number;
  currentStock: number;
  utilizationPct: number;
  topProduct: string;
  skuCount: number;
  hasAlert: boolean;
};

export type BackorderBucket = {
  bucket: string;
  emoji: string;
  count: number;
  historicalAvg: number;
  historicalStdDev: number;
  value: number;
  critical: number;
  avgDaysWaiting: number;
  color: string;
  isAnomaly: boolean;
};

export type TransferFunnelStage = {
  stage: string;
  count: number;
  avgHoursInStage: number;
  dropoffCount: number;
  dropoffPct: number;
};

export type CycleCountPoint = {
  week: string;
  accuracy: number;
  discrepancyCount: number;
  systemCount: number;
  actualCount: number;
  variancePct: string;
  isAnomaly: boolean;
};

export type DashboardAnalyticsData = {
  generatedAt: string;
  kpis: Record<DashboardRole, DashboardKpi[]>;
  executive: {
    inventoryValuationTrend: InventoryValuationPoint[];
    criticalStockProducts: CriticalStockProduct[];
    budgetPosition: BudgetPosition;
    topExposureProducts: TopExposureProduct[];
  };
  operations: {
    stockMovementFeed: StockMovementEvent[];
    warehouseZoneHeatmap: WarehouseBin[];
    backorderAging: BackorderBucket[];
    transferVelocityFunnel: TransferFunnelStage[];
    cycleCountAccuracyTrend: CycleCountPoint[];
  };
  sources?: {
    errors?: Array<{ source: string; error: string }>;
  };
};

const reportingAnalyticsServiceBaseUrl =
  process.env.NEXT_PUBLIC_REPORTING_ANALYTICS_SERVICE_URL ||
  process.env.VITE_REPORTING_ANALYTICS_SERVICE_URL ||
  "http://localhost:4012";

const parseError = async (response: Response) => {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as { error?: string; details?: string | null };
    return json.error || json.details || text;
  } catch {
    return text || `Request failed with status ${response.status}`;
  }
};

export const fetchDashboardAnalytics = async () => {
  const response = await fetch(`${reportingAnalyticsServiceBaseUrl}/reporting/dashboard-data`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as DashboardAnalyticsData;
};
