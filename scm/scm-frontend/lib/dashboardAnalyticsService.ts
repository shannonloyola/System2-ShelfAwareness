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

// Add a robust fallback in case the env var was set to an empty string, a relative path, or just a port
const getBaseUrl = () => {
  if (
    !reportingAnalyticsServiceBaseUrl || 
    reportingAnalyticsServiceBaseUrl.trim() === "" ||
    !reportingAnalyticsServiceBaseUrl.startsWith("http")
  ) {
    return "http://localhost:4012";
  }
  return reportingAnalyticsServiceBaseUrl;
};

const parseError = async (response: Response) => {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as { error?: string; details?: string | null };
    return json.error || json.details || text;
  } catch {
    return text || `Request failed with status ${response.status}`;
  }
};

const shouldBypassFetch = () => {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem("USE_REAL_SERVICES") !== "true";
  }
  return true;
};

export const fetchDashboardAnalytics = async () => {
  if (shouldBypassFetch()) {
    return MOCK_DASHBOARD_DATA;
  }
  try {
    const response = await fetch(`${getBaseUrl()}/reporting/dashboard-data`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    return (await response.json()) as DashboardAnalyticsData;
  } catch (error) {
    console.log("ℹ️ Reporting Service is offline. Using local mock data fallback.");
    return MOCK_DASHBOARD_DATA;
  }
};

const MOCK_DASHBOARD_DATA: DashboardAnalyticsData = {
  generatedAt: new Date().toISOString(),
  kpis: {
    Executive: [
      { label: "Total Assets Value", value: "₱4,580,250", delta: 12.5, trend: [40, 45, 42, 48, 50, 52] },
      { label: "Average Order Value", value: "₱148,000", delta: -2.3, trend: [15, 14, 16, 14, 15, 14.8] },
      { label: "Critical Stock Alerts", value: "5 Items", delta: -15, inverseGood: true, trend: [8, 7, 9, 6, 5, 5] },
    ],
    Operations: [
      { label: "Cycle Count Accuracy", value: "98.4%", delta: 1.2, trend: [95, 96, 97, 96.5, 98, 98.4] },
      { label: "Warehouse Space Utilized", value: "74.2%", delta: 5.6, trend: [68, 70, 72, 71, 73, 74.2] },
      { label: "Pending Transfers", value: "14 Orders", delta: 8, inverseGood: true, trend: [10, 12, 11, 15, 13, 14] },
    ],
    Procurement: [
      { label: "On-Time In-Full (OTIF)", value: "92.8%", delta: 3.4, trend: [88, 89, 91, 90, 92, 92.8] },
      { label: "Average PO Lead Time", value: "4.8 Days", delta: -8.5, trend: [5.2, 5.1, 5.0, 4.9, 4.8, 4.8] },
      { label: "Monthly Procurement Spent", value: "₱890,000", delta: 14.2, trend: [75, 78, 82, 85, 87, 89] },
    ],
  },
  executive: {
    inventoryValuationTrend: [
      { date: "Jan", value: 3800000 },
      { date: "Feb", value: 4100000 },
      { date: "Mar", value: 3950000 },
      { date: "Apr", value: 4300000 },
      { date: "May", value: 4580250 },
    ],
    criticalStockProducts: [
      { sku: "SKU-OTC-COUG", name: "Cough Syrup", category: "OTC Medications", stockLevel: 0, reservedStock: 2, value: 0, status: "zero" },
      { sku: "SKU-OTC-LORA", name: "Allergy Relief (Loratadine)", category: "OTC Medications", stockLevel: 12, reservedStock: 0, value: 155.88, status: "low" },
    ],
    budgetPosition: {
      allocated: 1200000,
      spent: 890000,
      committed: 150000,
      remaining: 160000,
      usedPct: 74.2,
      categories: [
        { category: "Pharma", allocated: 800000, spent: 610000, committed: 100000 },
        { category: "Medical Supplies", allocated: 400000, spent: 280000, committed: 50000 }
      ]
    },
    topExposureProducts: [
      { rank: 1, sku: "SKU-OTC-ACET", name: "Acetaminophen 500mg", category: "OTC Medications", exposure: 1348.50, trend: [120, 130, 134.8], budgetUtilizationPct: 85, budgetRemaining: 15 },
      { rank: 2, sku: "SKU-OTC-IBUP", name: "Ibuprofen 200mg", category: "OTC Medications", exposure: 1898.00, trend: [170, 180, 189.8], budgetUtilizationPct: 78, budgetRemaining: 22 },
    ]
  },
  operations: {
    stockMovementFeed: [
      { id: "mov-1", timestamp: new Date().toISOString(), type: "RECEIVING", severity: "info", sku: "SKU-OTC-ACET", productName: "Acetaminophen 500mg", fromLocation: "General Receiving", toLocation: "Main Warehouse Manila", quantity: 150, unit: "pcs", triggeredBy: "admin@shelfawareness.com", status: "completed" },
      { id: "mov-2", timestamp: new Date().toISOString(), type: "TRANSFER", severity: "warning", sku: "SKU-OTC-LORA", productName: "Allergy Relief (Loratadine)", fromLocation: "Main Warehouse Manila", toLocation: "Satellite Hub Pasig", quantity: 12, unit: "pcs", triggeredBy: "admin@shelfawareness.com", status: "completed" },
    ],
    warehouseZoneHeatmap: [
      { zone: "Zone A (Cold Storage)", aisle: "A1", bin: "B1", capacity: 100, currentStock: 85, utilizationPct: 85, topProduct: "Insulin Regular", skuCount: 3, hasAlert: false },
      { zone: "Zone B (General Shelf)", aisle: "B1", bin: "B2", capacity: 200, currentStock: 190, utilizationPct: 95, topProduct: "Acetaminophen 500mg", skuCount: 8, hasAlert: true },
    ],
    backorderAging: [
      { bucket: "0-15 Days", emoji: "⏱️", count: 8, historicalAvg: 6, historicalStdDev: 1.5, value: 45000, critical: 1, avgDaysWaiting: 6, color: "green", isAnomaly: false },
      { bucket: "16-30 Days", emoji: "⚠️", count: 4, historicalAvg: 3, historicalStdDev: 0.8, value: 24000, critical: 2, avgDaysWaiting: 22, color: "yellow", isAnomaly: false },
    ],
    transferVelocityFunnel: [
      { stage: "PO Drafted", count: 18, avgHoursInStage: 2, dropoffCount: 0, dropoffPct: 0 },
      { stage: "Supplier Shipped", count: 15, avgHoursInStage: 24, dropoffCount: 3, dropoffPct: 16.7 },
      { stage: "Warehouse Arrived", count: 14, avgHoursInStage: 4, dropoffCount: 1, dropoffPct: 6.7 },
    ],
    cycleCountAccuracyTrend: [
      { week: "Wk 19", accuracy: 97.5, discrepancyCount: 3, systemCount: 1000, actualCount: 997, variancePct: "-0.3%", isAnomaly: false },
      { week: "Wk 20", accuracy: 98.4, discrepancyCount: 1, systemCount: 1200, actualCount: 1199, variancePct: "-0.08%", isAnomaly: false },
    ]
  }
};
