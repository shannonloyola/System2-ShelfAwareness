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
    budgetPosition: BudgetPosition | null;
    topExposureProducts: TopExposureProduct[];
  };
  operations: {
    stockMovementFeed: StockMovementEvent[];
    backorderDetails: Array<{
      sku: string;
      name: string;
      quantity: number;
      daysAged: number;
      bucket: string;
    }>;
    warehouseZoneHeatmap: WarehouseBin[];
    backorderAging: BackorderBucket[];
    transferVelocityFunnel: TransferFunnelStage[];
    cycleCountAccuracyTrend: CycleCountPoint[];
  };
  procurement: {
    supplierReliabilityScorecards: Array<{
      supplierName: string;
      reliabilityScore: number;
      onTimeDeliveryPct: number;
      defectRate: number;
      poApprovalRate: number;
      riskLevel: string;
      totalPos: number;
      totalReceipts: number;
      leadTimeDays: number | null;
    }>;
    poLeadTimeDistribution: Array<{
      bucket: string;
      count: number;
      avgDays: number;
      color: string;
    }>;
    supplierLeadTimeDistribution: Array<{
      supplierName: string;
      leadTimeDays: number;
      totalPos: number;
      source: string;
      color: string;
    }>;
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

const asArray = <T = any>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

const asNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const asNullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const asText = (value: unknown, fallback = "N/A") => {
  const text = String(value ?? "").trim();
  if (!text || ["null", "undefined", "nan"].includes(text.toLowerCase())) {
    return fallback;
  }
  return text;
};

const sanitizeDashboardPayload = (payload: any): DashboardAnalyticsData => {
  const kpis = {
    Executive: asArray(payload?.kpis?.Executive).map((item: any) => ({
      label: asText(item?.label),
      value: asText(item?.value, "0"),
      delta: asNumber(item?.delta),
      inverseGood: Boolean(item?.inverseGood),
      trend: asArray(item?.trend).map((value) => asNumber(value)),
      subLabel: item?.subLabel ? asText(item.subLabel) : undefined,
    })),
    Operations: asArray(payload?.kpis?.Operations).map((item: any) => ({
      label: asText(item?.label),
      value: asText(item?.value, "0"),
      delta: asNumber(item?.delta),
      inverseGood: Boolean(item?.inverseGood),
      trend: asArray(item?.trend).map((value) => asNumber(value)),
      subLabel: item?.subLabel ? asText(item.subLabel) : undefined,
    })),
    Procurement: asArray(payload?.kpis?.Procurement).map((item: any) => ({
      label: asText(item?.label),
      value: asText(item?.value, "0"),
      delta: asNumber(item?.delta),
      inverseGood: Boolean(item?.inverseGood),
      trend: asArray(item?.trend).map((value) => asNumber(value)),
      subLabel: item?.subLabel ? asText(item.subLabel) : undefined,
    })),
  };

  const budget = payload?.executive?.budgetPosition;

  return {
    generatedAt: asText(payload?.generatedAt, new Date().toISOString()),
    kpis,
    executive: {
      inventoryValuationTrend: asArray(payload?.executive?.inventoryValuationTrend).map((item: any) => ({
        date: asText(item?.date),
        value: asNumber(item?.value),
        category: item?.category ? asText(item.category) : undefined,
        isAnomaly: Boolean(item?.isAnomaly),
      })),
      criticalStockProducts: asArray(payload?.executive?.criticalStockProducts).map((item: any) => ({
        sku: asText(item?.sku),
        name: asText(item?.name, "Unnamed SKU"),
        category: asText(item?.category, "Uncategorized"),
        stockLevel: asNumber(item?.stockLevel),
        reservedStock: asNumber(item?.reservedStock),
        dailyMovement: asNullableNumber(item?.dailyMovement),
        daysOfCover: asNullableNumber(item?.daysOfCover),
        value: asNumber(item?.value),
        status: asText(item?.status, "monitored"),
      })),
      budgetPosition: budget
        ? {
            allocated: asNumber(budget.allocated),
            spent: asNumber(budget.spent),
            committed: asNumber(budget.committed),
            remaining: asNumber(budget.remaining),
            usedPct: asNumber(budget.usedPct),
            categories: asArray(budget.categories).map((item: any) => ({
              category: asText(item?.category, "Current Budget"),
              allocated: asNumber(item?.allocated),
              spent: asNumber(item?.spent),
              committed: asNumber(item?.committed),
            })),
          }
        : null,
      topExposureProducts: asArray(payload?.executive?.topExposureProducts).map((item: any) => ({
        rank: asNumber(item?.rank),
        sku: asText(item?.sku),
        name: asText(item?.name, "Unnamed SKU"),
        category: asText(item?.category, "Uncategorized"),
        exposure: asNumber(item?.exposure),
        trend: asArray(item?.trend).map((value) => asNumber(value)),
        budgetUtilizationPct: asNumber(item?.budgetUtilizationPct),
        budgetRemaining: asNumber(item?.budgetRemaining),
      })),
    },
    operations: {
      stockMovementFeed: asArray(payload?.operations?.stockMovementFeed).map((item: any) => ({
        id: asText(item?.id),
        timestamp: asText(item?.timestamp, new Date(0).toISOString()),
        type: ["TRANSFER", "ADJUSTMENT", "RECEIVING", "DISPATCH", "CYCLE_COUNT"].includes(item?.type) ? item.type : "ADJUSTMENT",
        severity: ["info", "warning", "critical"].includes(item?.severity) ? item.severity : "info",
        sku: asText(item?.sku),
        productName: asText(item?.productName, "N/A"),
        fromLocation: asText(item?.fromLocation, "N/A"),
        toLocation: asText(item?.toLocation, "N/A"),
        quantity: asNumber(item?.quantity),
        unit: asText(item?.unit, "units"),
        triggeredBy: asText(item?.triggeredBy, "Microservice"),
        status: asText(item?.status, "updated"),
      })),
      backorderDetails: asArray(payload?.operations?.backorderDetails).map((item: any) => ({
        sku: asText(item?.sku),
        name: asText(item?.name, "N/A"),
        quantity: asNumber(item?.quantity),
        daysAged: asNumber(item?.daysAged),
        bucket: asText(item?.bucket, "N/A"),
      })),
      warehouseZoneHeatmap: asArray(payload?.operations?.warehouseZoneHeatmap).map((item: any) => ({
        zone: asText(item?.zone),
        aisle: asText(item?.aisle),
        bin: asText(item?.bin),
        capacity: asNumber(item?.capacity),
        currentStock: asNumber(item?.currentStock),
        utilizationPct: asNumber(item?.utilizationPct),
        topProduct: asText(item?.topProduct, "N/A"),
        skuCount: asNumber(item?.skuCount),
        hasAlert: Boolean(item?.hasAlert),
      })),
      backorderAging: asArray(payload?.operations?.backorderAging).map((item: any) => ({
        bucket: asText(item?.bucket),
        emoji: asText(item?.emoji, ""),
        count: asNumber(item?.count),
        historicalAvg: asNumber(item?.historicalAvg),
        historicalStdDev: asNumber(item?.historicalStdDev),
        value: asNumber(item?.value),
        critical: asNumber(item?.critical),
        avgDaysWaiting: asNumber(item?.avgDaysWaiting),
        color: asText(item?.color, "#00A3AD"),
        isAnomaly: Boolean(item?.isAnomaly),
      })),
      transferVelocityFunnel: asArray(payload?.operations?.transferVelocityFunnel).map((item: any) => ({
        stage: asText(item?.stage),
        count: asNumber(item?.count),
        avgHoursInStage: asNumber(item?.avgHoursInStage),
        dropoffCount: asNumber(item?.dropoffCount),
        dropoffPct: asNumber(item?.dropoffPct),
      })),
      cycleCountAccuracyTrend: asArray(payload?.operations?.cycleCountAccuracyTrend).map((item: any) => ({
        week: asText(item?.week),
        accuracy: asNumber(item?.accuracy),
        discrepancyCount: asNumber(item?.discrepancyCount),
        systemCount: asNumber(item?.systemCount),
        actualCount: asNumber(item?.actualCount),
        variancePct: asText(item?.variancePct, "0%"),
        isAnomaly: Boolean(item?.isAnomaly),
      })),
    },
    procurement: {
      supplierReliabilityScorecards: asArray(payload?.procurement?.supplierReliabilityScorecards).map((item: any) => ({
        supplierName: asText(item?.supplierName),
        reliabilityScore: asNumber(item?.reliabilityScore),
        onTimeDeliveryPct: asNumber(item?.onTimeDeliveryPct),
        defectRate: asNumber(item?.defectRate),
        poApprovalRate: asNumber(item?.poApprovalRate),
        riskLevel: asText(item?.riskLevel, "medium"),
        totalPos: asNumber(item?.totalPos),
        totalReceipts: asNumber(item?.totalReceipts),
        leadTimeDays: asNullableNumber(item?.leadTimeDays),
      })),
      poLeadTimeDistribution: asArray(payload?.procurement?.poLeadTimeDistribution).map((item: any) => ({
        bucket: asText(item?.bucket),
        count: asNumber(item?.count),
        avgDays: asNumber(item?.avgDays),
        color: asText(item?.color, "#00A3AD"),
      })),
      supplierLeadTimeDistribution: asArray(payload?.procurement?.supplierLeadTimeDistribution).map((item: any) => ({
        supplierName: asText(item?.supplierName),
        leadTimeDays: asNumber(item?.leadTimeDays),
        totalPos: asNumber(item?.totalPos),
        source: asText(item?.source, "Supplier master"),
        color: asText(item?.color, "#00A3AD"),
      })),
    },
    sources: {
      errors: asArray(payload?.sources?.errors).map((item: any) => ({
        source: asText(item?.source),
        error: asText(item?.error, "Unknown service error"),
      })),
    },
  };
};

export const fetchDashboardAnalytics = async () => {
  const response = await fetch(`${reportingAnalyticsServiceBaseUrl}/reporting/dashboard-data`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return sanitizeDashboardPayload(await response.json());
};

// ── Data Mining: PO Delay Risk Classification ──

export type DelayRiskResult = {
  risk: "low" | "medium" | "high" | "unknown";
  confidence: number;
  factors: string[];
  stats?: {
    totalPos: number;
    latePos: number;
    lateRatio: number;
    onTimeDeliveryPct: number;
    defectRate: number;
    reliabilityScore: number;
  };
};

export const fetchPODelayRisk = async (supplierName: string): Promise<DelayRiskResult> => {
  try {
    const response = await fetch(
      `${reportingAnalyticsServiceBaseUrl}/reporting/po-delay-risk?supplier_name=${encodeURIComponent(supplierName)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      console.error("Delay risk fetch failed:", response.status);
      return { risk: "unknown", confidence: 0, factors: ["Service unavailable"] };
    }
    return (await response.json()) as DelayRiskResult;
  } catch (error) {
    console.error("Delay risk fetch error:", error);
    return { risk: "unknown", confidence: 0, factors: ["Service unavailable"] };
  }
};

// ── Data Mining: Product Association Rules ──

export type ProductAssociation = {
  product_name: string;
  support: number;
  confidence: number;
  co_occurrences: number;
};

export type AssociationResult = {
  product: string;
  associations: ProductAssociation[];
  totalPOs: number;
  targetOccurrences: number;
  message?: string;
};

export const fetchProductAssociations = async (productName: string): Promise<AssociationResult> => {
  try {
    const response = await fetch(
      `${reportingAnalyticsServiceBaseUrl}/reporting/product-associations?product_name=${encodeURIComponent(productName)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      console.error("Association rules fetch failed:", response.status);
      return { product: productName, associations: [], totalPOs: 0, targetOccurrences: 0 };
    }
    return (await response.json()) as AssociationResult;
  } catch (error) {
    console.error("Association rules fetch error:", error);
    return { product: productName, associations: [], totalPOs: 0, targetOccurrences: 0 };
  }
};

