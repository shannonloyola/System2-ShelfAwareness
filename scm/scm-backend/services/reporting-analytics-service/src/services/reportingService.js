import { createHttpError } from "../lib/http.js";
import { env } from "../config/env.js";

const EMPTY_SOURCE = { data: [] };

const fetchJson = async (url, label) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return { ok: true, label, payload: await response.json() };
  } catch (error) {
    return {
      ok: false,
      label,
      payload: EMPTY_SOURCE,
      error: error?.message || "Request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
};

const extractArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.orders)) return payload.orders;
  return [];
};

const extractOneOrMany = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.data && typeof payload.data === "object") return [payload.data];
  if (payload && typeof payload === "object") return [payload];
  return [];
};

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const cleanText = (value, fallback = "N/A") => {
  const text = String(value ?? "").trim();
  if (!text || ["null", "undefined", "nan"].includes(text.toLowerCase())) {
    return fallback;
  }
  return text;
};

const compactTrend = (values) => {
  const cleaned = values.map((value) => toNumber(value)).filter((value) => Number.isFinite(value));
  if (cleaned.length >= 2) return cleaned.slice(-7);
  if (cleaned.length === 1) return [cleaned[0], cleaned[0]];
  return [0, 0];
};

const pctDelta = (trend) => {
  if (!trend || trend.length < 2) return 0;
  const first = toNumber(trend[0]);
  const last = toNumber(trend[trend.length - 1]);
  if (!first) return 0;
  return Number((((last - first) / first) * 100).toFixed(1));
};

const formatPhp = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  })
    .format(toNumber(value))
    .replace("PHP", "P");

const formatPct = (value) => `${toNumber(value).toFixed(1)}%`;

const normalizeInventory = (row) => ({
  id: cleanText(row.id || row.inventory_id || row.uuid || row.sku, "UNKNOWN"),
  sku: cleanText(row.sku || row.product_sku || row.productSku, "UNKNOWN"),
  name: cleanText(row.name || row.product_name || row.productName || row.item_name, "Unnamed SKU"),
  unit: cleanText(row.unit || row.unit_of_measure, "units"),
  stockOnHand: toNumber(row.systemCount ?? row.system_count ?? row.inventory_on_hand ?? row.stock_on_hand ?? row.quantity_on_hand),
  reservedStock: toNumber(row.reservedStock ?? row.reserved_stock ?? row.reserved_quantity),
  status: cleanText(row.status || row.stock_status, "").toLowerCase(),
  lastUpdated: row.lastUpdated || row.last_updated || row.updated_at || row.created_at,
});

const normalizeProduct = (row) => ({
  productId: cleanText(row.product_id || row.id || row.product_uuid || row.productUuid, "UNKNOWN"),
  sku: cleanText(row.sku || row.product_sku, "UNKNOWN"),
  name: cleanText(row.product_name || row.name || row.item_name, "Unnamed SKU"),
  category: cleanText(row.category || row.category_name, "Uncategorized"),
  supplier: cleanText(row.supplier || row.supplier_name, "Unassigned"),
  warehouseLocation: cleanText(row.warehouse_location || row.location || row.zone, "Unassigned"),
  unitPrice: toNumber(row.unit_price ?? row.price ?? row.cost),
  inventoryOnHand: toNumber(row.inventory_on_hand ?? row.stock_on_hand ?? row.quantity_on_hand),
});

const normalizePurchaseOrder = (row) => ({
  id: cleanText(row.po_id || row.purchase_order_id || row.id || row.po_number, "PO"),
  number: cleanText(row.po_number || row.poNo || row.id, "PO"),
  status: cleanText(row.status || row.order_status || row.approval_status, "pending").toLowerCase(),
  approvalStatus: cleanText(row.approval_status || row.status, "").toLowerCase(),
  supplier: cleanText(row.supplier_name || row.supplier, "Supplier"),
  totalAmount: toNumber(row.total_amount ?? row.total ?? row.amount ?? row.order_value),
  createdAt: row.created_at || row.order_date || row.createdAt,
  updatedAt: row.updated_at || row.updatedAt || row.created_at,
  expectedDeliveryDate: row.expected_delivery_date || row.expectedDeliveryDate,
  receivedAt: row.received_at || row.paid_at || row.fulfilled_at || row.updated_at,
});

const normalizeOrder = (row) => ({
  id: row.order_id || row.id || row.distribution_order_id,
  status: String(row.status || row.order_status || "").toLowerCase(),
  createdAt: row.created_at || row.order_date || row.createdAt,
  fulfilledAt: row.fulfilled_at || row.completed_at || row.updated_at,
  requestedQty: toNumber(row.requested_quantity ?? row.quantity ?? row.total_quantity),
  fulfilledQty: toNumber(row.fulfilled_quantity ?? row.shipped_quantity ?? row.quantity_fulfilled),
});

const normalizeBackorder = (row) => ({
  sku: cleanText(row.sku || row.product_sku, "UNKNOWN"),
  name: cleanText(row.product_name || row.name, "Backordered SKU"),
  count: toNumber(row.count ?? row.backorder_count ?? row.qty_backordered ?? row.quantity),
  value: toNumber(row.value ?? row.total_value ?? row.exposure_value),
  ageDays: toNumber(row.age_days ?? row.days_waiting ?? row.days_backordered),
  isCritical: Boolean(row.is_critical || row.critical || toNumber(row.age_days ?? row.days_waiting) >= 30),
});

const getBackorderBucket = (ageDays) => {
  if (ageDays <= 6) return "<7 days";
  if (ageDays <= 14) return "7-14 days";
  if (ageDays <= 30) return "14-30 days";
  return "30+ days";
};

const normalizeSupplier = (row) => ({
  name: cleanText(row.supplier_name || row.supplier || row.name, "Supplier"),
  leadTimeDays: toNumber(row.lead_time_days ?? row.leadTimeDays),
  status: cleanText(row.status, "").toLowerCase(),
});

const normalizeSupplierScorecard = (row) => ({
  supplierName: cleanText(row.supplier_name || row.supplierName, "Supplier"),
  reliabilityScore: toNumber(row.reliability_score ?? row.reliabilityScore),
  onTimeDeliveryPct: toNumber(row.on_time_delivery_pct ?? row.onTimeDeliveryPct),
  defectRate: toNumber(row.defect_rate ?? row.defectRate),
  poApprovalRate: toNumber(row.po_approval_rate ?? row.poApprovalRate),
  riskLevel: cleanText(row.risk_level || row.riskLevel, "medium").toLowerCase(),
  totalPos: toNumber(row.total_pos ?? row.totalPos),
  totalReceipts: toNumber(row.total_receipts ?? row.totalReceipts),
  leadTimeDays: row.lead_time_days === null || row.leadTimeDays === null ? null : toNumber(row.lead_time_days ?? row.leadTimeDays, null),
});

const buildKpi = ({ label, value, trend, subLabel, inverseGood = false }) => ({
  label,
  value,
  delta: pctDelta(trend),
  trend: compactTrend(trend),
  subLabel,
  inverseGood,
});

const buildWarehouseHeatmap = (products, inventoryBySku) => {
  const grouped = new Map();

  products.forEach((product) => {
    const location = product.warehouseLocation || "Unassigned";
    const parts = location.split(/[-/]/).map((part) => part.trim()).filter(Boolean);
    const zone = parts[0] || "Unassigned";
    const aisle = parts[1] || "Aisle 1";
    const bin = parts[2] || product.sku || "Bin";
    const inventory = inventoryBySku.get(product.sku);
    const currentStock = inventory?.stockOnHand ?? product.inventoryOnHand;
    const capacity = Math.max(100, currentStock + (inventory?.reservedStock || 0));
    const key = `${zone}|${aisle}|${bin}`;

    const existing = grouped.get(key) || {
      zone,
      aisle,
      bin,
      capacity: 0,
      currentStock: 0,
      topProduct: product.name,
      skuCount: 0,
      hasAlert: false,
    };

    existing.capacity += capacity;
    existing.currentStock += currentStock;
    existing.skuCount += 1;
    existing.hasAlert = existing.hasAlert || String(inventory?.status || "").includes("critical");
    if (currentStock > existing.currentStock) existing.topProduct = product.name;
    grouped.set(key, existing);
  });

  return Array.from(grouped.values()).slice(0, 48).map((bin) => ({
    ...bin,
    utilizationPct: bin.capacity > 0 ? Math.min(100, Math.round((bin.currentStock / bin.capacity) * 100)) : 0,
  }));
};

const buildBackorderBuckets = (backorders) => {
  const buckets = [
    { bucket: "<7 days", emoji: "<7d", min: 0, max: 6, color: "#10B981" },
    { bucket: "7-14 days", emoji: "7-14d", min: 7, max: 14, color: "#F59E0B" },
    { bucket: "14-30 days", emoji: "14-30d", min: 15, max: 30, color: "#f97316" },
    { bucket: "30+ days", emoji: "30+d", min: 31, max: Infinity, color: "#EF4444" },
  ];

  return buckets.map((bucket) => {
    const rows = backorders.filter((row) => row.ageDays >= bucket.min && row.ageDays <= bucket.max);
    const count = rows.reduce((sum, row) => sum + (row.count || 1), 0);
    const value = rows.reduce((sum, row) => sum + row.value, 0);
    const weightedWait = rows.reduce((sum, row) => sum + row.ageDays * (row.count || 1), 0);
    return {
      ...bucket,
      count,
      value,
      critical: rows.filter((row) => row.isCritical).length,
      avgDaysWaiting: count > 0 ? Number((weightedWait / count).toFixed(1)) : 0,
      historicalAvg: count,
      historicalStdDev: 1,
      isAnomaly: false,
    };
  });
};

const buildPoLeadTimeDistribution = (leadTimeSamples) => {
  const buckets = [
    { bucket: "0-7 days", min: 0, max: 7, color: "#22c55e" },
    { bucket: "8-14 days", min: 8, max: 14, color: "#00A3AD" },
    { bucket: "15-30 days", min: 15, max: 30, color: "#f59e0b" },
    { bucket: "30+ days", min: 31, max: Infinity, color: "#ef4444" },
  ];

  return buckets.map((bucket) => {
    const samples = leadTimeSamples.filter((days) => days >= bucket.min && days <= bucket.max);
    return {
      ...bucket,
      count: samples.length,
      avgDays: samples.length
        ? Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(1))
        : 0,
    };
  });
};

const buildSupplierLeadTimeDistribution = (supplierScorecards, suppliers, receivedPurchaseOrders) => {
  const receivedLeadTimesBySupplier = new Map();

  receivedPurchaseOrders.forEach((po) => {
    if (!po.supplier || !po.createdAt || !po.receivedAt) return;
    const start = new Date(po.createdAt).getTime();
    const end = new Date(po.receivedAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;

    const key = po.supplier.trim().toLowerCase();
    const current = receivedLeadTimesBySupplier.get(key) || {
      supplierName: po.supplier,
      samples: [],
    };
    current.samples.push((end - start) / 86400000);
    receivedLeadTimesBySupplier.set(key, current);
  });

  const supplierRows = new Map();

  suppliers.forEach((supplier) => {
    if (!supplier.name) return;
    supplierRows.set(supplier.name.trim().toLowerCase(), {
      supplierName: supplier.name,
      leadTimeDays: supplier.leadTimeDays || 0,
      totalPos: 0,
      source: "Supplier master",
    });
  });

  supplierScorecards.forEach((scorecard) => {
    const key = scorecard.supplierName.trim().toLowerCase();
    const received = receivedLeadTimesBySupplier.get(key);
    const receivedAvg = received?.samples?.length
      ? received.samples.reduce((sum, value) => sum + value, 0) / received.samples.length
      : null;

    supplierRows.set(key, {
      supplierName: scorecard.supplierName,
      leadTimeDays: Number((receivedAvg ?? scorecard.leadTimeDays ?? 0).toFixed(1)),
      totalPos: scorecard.totalPos,
      source: receivedAvg !== null ? "Received PO history" : "Supplier master",
    });
  });

  return Array.from(supplierRows.values())
    .filter((supplier) => supplier.leadTimeDays > 0)
    .sort((a, b) => b.leadTimeDays - a.leadTimeDays)
    .slice(0, 8)
    .map((supplier, index) => ({
      ...supplier,
      color: ["#00A3AD", "#22c55e", "#f59e0b", "#ef4444", "#64748b", "#8EA5B8"][index % 6],
    }));
};

const buildDashboardPayload = ({
  inventoryRows,
  productRows,
  poRows,
  orderRows,
  backorderRows,
  supplierRows,
  supplierScorecardRows,
  cycleCountRows,
  budget,
  inventoryValue,
}) => {
  const inventory = inventoryRows.map(normalizeInventory);
  const products = productRows.map(normalizeProduct);
  const purchaseOrders = poRows.map(normalizePurchaseOrder);
  const orders = orderRows.map(normalizeOrder);
  const backorders = backorderRows.map(normalizeBackorder);
  const suppliers = supplierRows.map(normalizeSupplier);
  const supplierByName = new Map(suppliers.map((supplier) => [supplier.name.trim().toLowerCase(), supplier]));
  const supplierScorecards = supplierScorecardRows.map((row) => {
    const scorecard = normalizeSupplierScorecard(row);
    const supplier = supplierByName.get(scorecard.supplierName.trim().toLowerCase());
    return {
      ...scorecard,
      leadTimeDays: scorecard.leadTimeDays ?? supplier?.leadTimeDays ?? null,
    };
  });

  const productBySku = new Map(products.map((product) => [product.sku, product]));
  const inventoryBySku = new Map(inventory.map((item) => [item.sku, item]));

  const exposureProducts = inventory
    .map((item) => {
      const product = productBySku.get(item.sku) || {};
      const unitPrice = product.unitPrice || 0;
      const exposure = item.stockOnHand * unitPrice;
      return {
        sku: item.sku,
        name: product.name || item.name,
        category: product.category || "Uncategorized",
        exposure,
        trend: compactTrend([exposure, exposure]),
        budgetUtilizationPct: budget?.allocated_amount ? (toNumber(budget.spent_amount) / toNumber(budget.allocated_amount)) * 100 : 0,
        budgetRemaining: Math.max(0, toNumber(budget?.allocated_amount) - toNumber(budget?.spent_amount)),
      };
    })
    .filter((item) => item.exposure > 0)
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 10)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const criticalStockProducts = inventory
    .map((item) => {
      const product = productBySku.get(item.sku) || {};
      const unitPrice = product.unitPrice || 0;
      const available = Math.max(0, item.stockOnHand - item.reservedStock);
      const daysOfCover = item.reservedStock > 0 ? available / item.reservedStock : null;
      const criticalScore = String(item.status).includes("critical") || available <= 10 || (daysOfCover !== null && daysOfCover < 7);
      return {
        sku: item.sku,
        name: product.name || item.name,
        category: product.category || "Uncategorized",
        stockLevel: item.stockOnHand,
        reservedStock: item.reservedStock,
        dailyMovement: item.reservedStock || null,
        daysOfCover,
        value: item.stockOnHand * unitPrice,
        status: criticalScore ? "critical" : "monitored",
      };
    })
    .filter((item) => item.status === "critical")
    .sort((a, b) => (a.daysOfCover ?? 999) - (b.daysOfCover ?? 999) || b.value - a.value)
    .slice(0, 10);

  const committed = purchaseOrders
    .filter((po) => !["received", "completed", "cancelled", "closed"].includes(po.status))
    .reduce((sum, po) => sum + po.totalAmount, 0);
  const hasBudget = Boolean(budget && budget.allocated_amount !== undefined && budget.allocated_amount !== null);
  const allocated = hasBudget ? toNumber(budget?.allocated_amount) : null;
  const spent = hasBudget ? toNumber(budget?.spent_amount) : null;
  const remaining = hasBudget ? Math.max(0, allocated - spent - committed) : null;
  const inventoryTotal = toNumber(inventoryValue?.total_inventory_value_php) || exposureProducts.reduce((sum, item) => sum + item.exposure, 0);
  const orderLineCount = orders.length;
  const fulfilledOrders = orders.filter((order) => ["fulfilled", "completed", "delivered", "shipped"].includes(order.status)).length;
  const fillRate = orderLineCount > 0 ? (fulfilledOrders / orderLineCount) * 100 : 0;
  const backorderCount = backorders.reduce((sum, item) => sum + (item.count || 1), 0);
  const pendingApprovals = purchaseOrders.filter((po) => po.approvalStatus.includes("pending") || po.status.includes("pending")).length;
  const pendingTransfers = purchaseOrders.filter((po) => !["received", "completed", "cancelled", "closed"].includes(po.status)).length;
  const receivedPurchaseOrders = purchaseOrders.filter((po) => ["received", "completed", "closed"].includes(po.status));
  const leadTimeSamples = [
    ...suppliers.map((supplier) => supplier.leadTimeDays).filter((days) => days > 0),
    ...receivedPurchaseOrders
      .map((po) => {
        if (!po.createdAt || !po.receivedAt) return null;
        const start = new Date(po.createdAt).getTime();
        const end = new Date(po.receivedAt).getTime();
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
        return (end - start) / 86400000;
      })
      .filter((days) => days !== null),
  ];
  const avgLeadTimeDays = leadTimeSamples.length
    ? leadTimeSamples.reduce((sum, value) => sum + value, 0) / leadTimeSamples.length
    : null;
  const supplierOnTimePct = supplierScorecards.length
    ? supplierScorecards.reduce((sum, supplier) => sum + supplier.onTimeDeliveryPct, 0) / supplierScorecards.length
    : null;
  const recentCycleCounts = cycleCountRows.filter((row) => row && row.sku);
  const cycleCountAccuracy =
    recentCycleCounts.length && inventoryBySku.size
      ? (recentCycleCounts.filter((row) => {
          const inventoryItem = inventoryBySku.get(row.sku);
          if (!inventoryItem) return false;
          return toNumber(row.physical_count ?? row.physicalCount) === inventoryItem.stockOnHand;
        }).length / recentCycleCounts.length) * 100
      : null;
  const fulfillmentDurations = orders
    .map((order) => {
      if (!order.createdAt || !order.fulfilledAt) return null;
      const start = new Date(order.createdAt).getTime();
      const end = new Date(order.fulfilledAt).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
      return (end - start) / 86400000;
    })
    .filter((value) => value !== null);
  const avgFulfillmentDays = fulfillmentDurations.length
    ? fulfillmentDurations.reduce((sum, value) => sum + value, 0) / fulfillmentDurations.length
    : 0;

  const budgetUsedPct = hasBudget && allocated > 0 ? ((spent + committed) / allocated) * 100 : null;
  const stockHealth = inventory.length > 0 ? ((inventory.length - criticalStockProducts.length) / inventory.length) * 100 : 0;
  const budgetHealth = budgetUsedPct === null ? 100 : Math.max(0, 100 - budgetUsedPct);
  const supplyScoreNumeric = Math.round((fillRate * 0.4 + stockHealth * 0.35 + budgetHealth * 0.25) * 10) / 10;

  const movementFeed = [
    ...inventory
      .filter((item) => item.lastUpdated)
      .map((item) => ({
        id: `INV-${item.id}`,
        timestamp: item.lastUpdated,
        type: "ADJUSTMENT",
        severity: item.status.includes("critical") ? "critical" : item.status.includes("low") ? "warning" : "info",
        sku: item.sku,
        productName: productBySku.get(item.sku)?.name || item.name,
        fromLocation: productBySku.get(item.sku)?.warehouseLocation || "Inventory",
        toLocation: productBySku.get(item.sku)?.warehouseLocation || "Inventory",
        quantity: item.stockOnHand,
        unit: item.unit,
        triggeredBy: "Inventory service",
        status: cleanText(item.status, "updated"),
      })),
    ...purchaseOrders.map((po) => ({
      id: po.number,
      timestamp: po.updatedAt || po.createdAt || new Date().toISOString(),
      type: po.status.includes("received") ? "RECEIVING" : "TRANSFER",
      severity: po.status.includes("pending") ? "warning" : "info",
      sku: po.number,
      productName: po.supplier,
      fromLocation: "Supplier",
      toLocation: "Warehouse",
      quantity: 1,
      unit: "PO",
      triggeredBy: "Procurement service",
      status: cleanText(po.status, "pending"),
    })),
  ]
    .filter((event) => event.timestamp)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 80);

  const hoursBetween = (startValue, endValue = new Date().toISOString()) => {
    if (!startValue) return 0;
    const start = new Date(startValue).getTime();
    const end = new Date(endValue).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
    return (end - start) / 3600000;
  };
  const averageHours = (rows) => {
    const values = rows.map((po) => {
      if (po.status.includes("received") || po.status.includes("completed") || po.status.includes("closed")) {
        return hoursBetween(po.createdAt, po.receivedAt || po.updatedAt);
      }
      return hoursBetween(po.updatedAt || po.createdAt);
    }).filter((value) => value > 0);
    return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : 0;
  };

  const stageRows = {
    "Initiated": purchaseOrders,
    "Pending Approval": purchaseOrders.filter((po) => po.approvalStatus.includes("pending") || po.status.includes("pending")),
    "In Transit": purchaseOrders.filter((po) => po.status.includes("transit") || po.status.includes("approved") || po.status.includes("ordered")),
    "Quality Check": purchaseOrders.filter((po) => po.status.includes("quality") || po.status.includes("inspection")),
    "Received": purchaseOrders.filter((po) => po.status.includes("received") || po.status.includes("completed") || po.status.includes("closed")),
  };
  const stages = Object.keys(stageRows);
  const stageCounts = Object.fromEntries(stages.map((stage) => [stage, stageRows[stage].length]));
  const transferVelocityFunnel = stages.map((stage, index) => {
    const count = stageCounts[stage] || 0;
    const previousCount = index === 0 ? count : stageCounts[stages[index - 1]] || 0;
    const dropoffCount = Math.max(0, previousCount - count);
    return {
      stage,
      count,
      avgHoursInStage: averageHours(stageRows[stage]),
      dropoffCount,
      dropoffPct: previousCount > 0 ? Number(((dropoffCount / previousCount) * 100).toFixed(1)) : 0,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      Executive: [
        buildKpi({ label: "Total Inventory Value", value: formatPhp(inventoryTotal), trend: [inventoryTotal, inventoryTotal] }),
        buildKpi({ label: "Fill Rate %", value: formatPct(fillRate), trend: [fillRate, fillRate], subLabel: `of ${orderLineCount.toLocaleString()} order lines` }),
        ...(hasBudget
          ? [buildKpi({ label: "Budget Utilization", value: formatPct(budgetUsedPct), trend: [budgetUsedPct, budgetUsedPct] })]
          : []),
        buildKpi({ label: "Critical SKUs Count", value: String(criticalStockProducts.length), trend: [criticalStockProducts.length, criticalStockProducts.length], subLabel: `of ${inventory.length.toLocaleString()} active SKUs`, inverseGood: true }),
        buildKpi({ label: "Supply Chain Score", value: supplyScoreNumeric >= 90 ? "A" : supplyScoreNumeric >= 80 ? "A-" : supplyScoreNumeric >= 70 ? "B" : "C", trend: [supplyScoreNumeric, supplyScoreNumeric] }),
      ],
      Operations: [
        buildKpi({ label: "Pending Transfers", value: String(pendingTransfers), trend: [pendingTransfers, pendingTransfers], inverseGood: true }),
        buildKpi({ label: "Backorder Count", value: String(backorderCount), trend: [backorderCount, backorderCount], inverseGood: true }),
        ...(cycleCountAccuracy !== null
          ? [buildKpi({ label: "Cycle Count Accuracy", value: formatPct(cycleCountAccuracy), trend: [cycleCountAccuracy, cycleCountAccuracy] })]
          : []),
        buildKpi({ label: "Pending Approvals", value: String(pendingApprovals), trend: [pendingApprovals, pendingApprovals], inverseGood: true }),
        ...(avgFulfillmentDays
          ? [buildKpi({ label: "Avg Fulfillment (Days)", value: avgFulfillmentDays.toFixed(1), trend: [avgFulfillmentDays, avgFulfillmentDays], inverseGood: true })]
          : []),
      ],
      Procurement: [
        buildKpi({ label: "Open POs", value: String(purchaseOrders.length), trend: [purchaseOrders.length, purchaseOrders.length] }),
        ...(avgLeadTimeDays !== null
          ? [buildKpi({ label: "Avg Lead Time (Days)", value: avgLeadTimeDays.toFixed(1), trend: [avgLeadTimeDays, avgLeadTimeDays], inverseGood: true })]
          : []),
        ...(hasBudget
          ? [buildKpi({ label: "Budget Remaining", value: formatPhp(remaining), trend: [remaining, remaining], inverseGood: true })]
          : []),
        ...(supplierOnTimePct !== null
          ? [buildKpi({ label: "Supplier On-Time %", value: formatPct(supplierOnTimePct), trend: [supplierOnTimePct, supplierOnTimePct] })]
          : []),
        buildKpi({ label: "GRNs Pending", value: String(pendingTransfers), trend: [pendingTransfers, pendingTransfers], inverseGood: true }),
      ],
    },
    executive: {
      inventoryValuationTrend: [
        {
          date: new Date().toISOString().slice(0, 10),
          value: inventoryTotal,
          category: "total",
        },
      ],
      criticalStockProducts,
      budgetPosition: hasBudget
        ? {
            allocated,
            spent,
            committed,
            remaining,
            usedPct: budgetUsedPct,
            categories: [
              {
                category: "Current Budget",
                allocated,
                spent,
                committed,
              },
            ],
          }
        : null,
      topExposureProducts: exposureProducts.slice(0, 4),
    },
    operations: {
      stockMovementFeed: movementFeed,
      backorderDetails: backorders.map((backorder) => ({
        sku: backorder.sku,
        name: productBySku.get(backorder.sku)?.name || backorder.name,
        quantity: backorder.count || 1,
        daysAged: backorder.ageDays,
        bucket: getBackorderBucket(backorder.ageDays),
      })),
      warehouseZoneHeatmap: buildWarehouseHeatmap(products, inventoryBySku),
      backorderAging: buildBackorderBuckets(backorders),
      transferVelocityFunnel,
      cycleCountAccuracyTrend: [],
    },
    procurement: {
      supplierReliabilityScorecards: supplierScorecards,
      poLeadTimeDistribution: buildPoLeadTimeDistribution(leadTimeSamples),
      supplierLeadTimeDistribution: buildSupplierLeadTimeDistribution(supplierScorecards, suppliers, receivedPurchaseOrders),
    },
  };
};

export const generateReport = async (options) => {
  const { type, format = "json" } = options;

  if (!type) {
    throw createHttpError(400, "Missing required field: type");
  }

  console.log(`[ReportingService] Generating ${type} report in ${format} format...`);

  // Simulation
  await new Promise((resolve) => setTimeout(resolve, 200));

  return {
    reportId: `rep_${Math.random().toString(36).substr(2, 9)}`,
    type,
    format,
    generatedAt: new Date().toISOString(),
    data: [], // Placeholder for actual analytical data
  };
};

export const getDashboardMetrics = async () => {
  const dashboardData = await getDashboardData();
  const operationsKpis = dashboardData.kpis?.Operations || [];
  const procurementKpis = dashboardData.kpis?.Procurement || [];

  return {
    inventoryLevels: dashboardData.executive.criticalStockProducts.length > 0 ? "Critical attention required" : "Normal",
    pendingOrders: procurementKpis.find((item) => item.label === "Open POs")?.value || "0",
    activeSuppliers: String(dashboardData.procurement.supplierReliabilityScorecards.length),
    backorderCount: operationsKpis.find((item) => item.label === "Backorder Count")?.value || "0",
  };
};

export const getDashboardData = async () => {
  const [
    inventoryResult,
    productsResult,
    backorderAgingResult,
    backorderAlertsResult,
    purchaseOrdersResult,
    monthlyBudgetResult,
    inventoryValueResult,
    ordersResult,
    suppliersResult,
    cycleCountsResult,
  ] = await Promise.all([
    fetchJson(`${env.inventoryServiceUrl}/inventory?limit=500`, "inventory"),
    fetchJson(`${env.productCatalogServiceUrl}/products?limit=500`, "products"),
    fetchJson(`${env.inventoryServiceUrl}/backorder-aging?limit=500`, "backorder-aging"),
    fetchJson(`${env.inventoryServiceUrl}/backorder-alerts?limit=100`, "backorder-alerts"),
    fetchJson(`${env.procurementServiceUrl}/purchase-orders?limit=500`, "purchase-orders"),
    fetchJson(`${env.procurementServiceUrl}/purchase-orders/dashboard/monthly-budget/current`, "monthly-budget"),
    fetchJson(`${env.distributionServiceUrl}/inventory-value/total`, "inventory-value"),
    fetchJson(`${env.distributionServiceUrl}/orders?limit=500`, "distribution-orders"),
    fetchJson(`${env.supplierServiceUrl}/suppliers?limit=100`, "suppliers"),
    fetchJson(`${env.cycleCountingServiceUrl}/cycle-counts/recent?limit=500`, "cycle-counts"),
  ]);

  const purchaseOrders = extractArray(purchaseOrdersResult.payload);
  const supplierNames = Array.from(
    new Set(
      [
        ...extractArray(suppliersResult.payload).map((supplier) => supplier.supplier_name || supplier.supplier),
        ...purchaseOrders.map((po) => po.supplier_name || po.supplier),
      ]
        .map((name) => cleanText(name, ""))
        .filter(Boolean),
    ),
  ).slice(0, 8);

  const supplierScorecardResults = await Promise.all(
    supplierNames.map((supplierName) =>
      fetchJson(`${env.supplierServiceUrl}/supplier-scorecards?supplier_name=${encodeURIComponent(supplierName)}`, `supplier-scorecard:${supplierName}`),
    ),
  );

  const sourceErrors = [
    inventoryResult,
    productsResult,
    backorderAgingResult,
    backorderAlertsResult,
    purchaseOrdersResult,
    monthlyBudgetResult,
    inventoryValueResult,
    ordersResult,
    suppliersResult,
    cycleCountsResult,
    ...supplierScorecardResults,
  ]
    .filter((result) => !result.ok)
    .map((result) => ({ source: result.label, error: result.error }));

  const backorderRows = extractArray(backorderAgingResult.payload);

  return {
    ...buildDashboardPayload({
      inventoryRows: extractArray(inventoryResult.payload),
      productRows: extractArray(productsResult.payload),
      poRows: purchaseOrders,
      orderRows: extractArray(ordersResult.payload),
      backorderRows,
      supplierRows: extractArray(suppliersResult.payload),
      supplierScorecardRows: supplierScorecardResults
        .filter((result) => result.ok)
        .flatMap((result) => extractOneOrMany(result.payload?.data || result.payload))
        .filter(Boolean),
      cycleCountRows: extractArray(cycleCountsResult.payload),
      budget: monthlyBudgetResult.payload?.data ?? null,
      inventoryValue: inventoryValueResult.payload?.data || inventoryValueResult.payload || {},
    }),
    sources: {
      errors: sourceErrors,
    },
  };
};
