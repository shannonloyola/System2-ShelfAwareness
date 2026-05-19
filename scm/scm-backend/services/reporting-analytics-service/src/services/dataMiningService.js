import { env } from "../config/env.js";

// ─── Shared Helpers ──────────────────────────────────────────────────────────

const fetchJson = async (url, label) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`[DataMining] Failed to fetch ${label}:`, error?.message);
    return null;
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

const cleanText = (value, fallback = "") =>
  String(value ?? "").trim() || fallback;

// ─── Feature 1: PO Delay Risk Classification ────────────────────────────────
//
// Classification rules (weighted decision tree):
//   HIGH  risk: on_time_delivery_pct < 85%  OR  late_ratio > 0.30  OR  defect_rate > 10%
//   MEDIUM risk: on_time_delivery_pct < 95%  OR  late_ratio > 0.15
//   LOW   risk: everything else
//
// Data sources:
//   - procurement-service: /purchase-orders (for is_late history)
//   - supplier-service: /supplier-scorecards (for on_time_delivery_pct, defect_rate)
// ─────────────────────────────────────────────────────────────────────────────

export const computeDelayRisk = async (supplierName) => {
  if (!supplierName || !supplierName.trim()) {
    return { risk: "unknown", confidence: 0, factors: ["No supplier specified"] };
  }

  const normalizedName = supplierName.trim();

  // Fetch purchase orders for this supplier
  const posPayload = await fetchJson(
    `${env.procurementServiceUrl}/purchase-orders?limit=500`,
    "purchase-orders",
  );

  // Fetch supplier scorecard
  const scorecardPayload = await fetchJson(
    `${env.supplierServiceUrl}/supplier-scorecards?supplier_name=${encodeURIComponent(normalizedName)}`,
    "supplier-scorecard",
  );

  const allPos = extractArray(posPayload);
  const supplierPos = allPos.filter(
    (po) =>
      cleanText(po.supplier_name).toLowerCase() ===
      normalizedName.toLowerCase(),
  );

  const totalPos = supplierPos.length;

  // If no PO history for this supplier, return unknown with info
  if (totalPos === 0) {
    return {
      risk: "unknown",
      confidence: 0,
      factors: ["No historical PO data for this supplier"],
      stats: { totalPos: 0 },
    };
  }

  // Count late POs
  const latePos = supplierPos.filter((po) => po.is_late === true).length;
  const lateRatio = totalPos > 0 ? latePos / totalPos : 0;

  // Extract scorecard metrics
  const scorecardData =
    scorecardPayload?.data ??
    (Array.isArray(scorecardPayload) ? scorecardPayload[0] : scorecardPayload);

  const onTimeDeliveryPct = Number(
    scorecardData?.on_time_delivery_pct ?? scorecardData?.onTimeDeliveryPct ?? 100,
  );
  const defectRate = Number(
    scorecardData?.defect_rate ?? scorecardData?.defectRate ?? 0,
  );
  const reliabilityScore = Number(
    scorecardData?.reliability_score ?? scorecardData?.reliabilityScore ?? 100,
  );

  // ── Classification Logic ──
  const factors = [];
  let risk = "low";

  // HIGH risk conditions
  if (onTimeDeliveryPct < 85) {
    risk = "high";
    factors.push(`On-time delivery is only ${onTimeDeliveryPct.toFixed(1)}% (< 85%)`);
  }
  if (lateRatio > 0.3) {
    risk = "high";
    factors.push(
      `${(lateRatio * 100).toFixed(0)}% of past POs were delayed (${latePos}/${totalPos})`,
    );
  }
  if (defectRate > 10) {
    risk = "high";
    factors.push(`Defect rate is ${defectRate.toFixed(1)}% (> 10%)`);
  }

  // MEDIUM risk conditions (only upgrade if not already high)
  if (risk !== "high") {
    if (onTimeDeliveryPct < 95) {
      risk = "medium";
      factors.push(`On-time delivery is ${onTimeDeliveryPct.toFixed(1)}% (< 95%)`);
    }
    if (lateRatio > 0.15) {
      risk = "medium";
      factors.push(
        `${(lateRatio * 100).toFixed(0)}% of past POs were delayed (${latePos}/${totalPos})`,
      );
    }
  }

  if (factors.length === 0) {
    factors.push("Supplier has good historical performance");
  }

  // Confidence = how much data we have (more POs = higher confidence)
  const confidence = Math.min(1, totalPos / 10);

  return {
    risk,
    confidence: Number(confidence.toFixed(2)),
    factors,
    stats: {
      totalPos,
      latePos,
      lateRatio: Number((lateRatio * 100).toFixed(1)),
      onTimeDeliveryPct: Number(onTimeDeliveryPct.toFixed(1)),
      defectRate: Number(defectRate.toFixed(1)),
      reliabilityScore: Number(reliabilityScore.toFixed(1)),
    },
  };
};

// Smart text matching helper
const matchProductText = (itemA, itemB) => {
  const a = cleanText(itemA).toLowerCase();
  const b = cleanText(itemB).toLowerCase();
  if (a === b) return true;
  if (a.length > 5 && b.length > 5) {
    if (a.includes(b) || b.includes(a)) return true;
  }
  const skuA = a.split(" - ")[0].trim();
  const skuB = b.split(" - ")[0].trim();
  if (skuA && skuB && skuA === skuB && skuA.length > 2) return true;
  return false;
};

export const computeProductAssociations = async (productName) => {
  if (!productName || !productName.trim()) {
    return { product: productName, associations: [] };
  }

  const targetLabel = productName.trim();
  const normalizedTarget = targetLabel.toLowerCase();

  // Step 1: Fetch all purchase orders
  const posPayload = await fetchJson(
    `${env.procurementServiceUrl}/purchase-orders?limit=500`,
    "purchase-orders-for-associations",
  );

  const allPos = extractArray(posPayload);

  let validBaskets = [];
  if (allPos.length > 0) {
    // Step 2: Fetch items for each PO (batch with concurrency limit)
    const CONCURRENCY = 10;
    const poBaskets = [];

    for (let i = 0; i < allPos.length; i += CONCURRENCY) {
      const batch = allPos.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (po) => {
          const itemsPayload = await fetchJson(
            `${env.procurementServiceUrl}/purchase-orders/${encodeURIComponent(po.po_id)}/items`,
            `po-items-${po.po_id}`,
          );
          const items = extractArray(itemsPayload);
          return items
            .map((item) => cleanText(item.item_name))
            .filter(Boolean);
        }),
      );
      poBaskets.push(...results);
    }
    validBaskets = poBaskets.filter((basket) => basket.length > 0);
  }

  const totalPOs = validBaskets.length;
  let associations = [];
  let targetOccurrences = 0;

  if (totalPOs > 0) {
    // Step 3: Compute co-occurrence counts
    const posWithTarget = validBaskets.filter((basket) =>
      basket.some((item) => matchProductText(item, normalizedTarget)),
    );
    targetOccurrences = posWithTarget.length;

    if (targetOccurrences > 0) {
      const coOccurrenceCounts = new Map();

      for (const basket of posWithTarget) {
        const uniqueItems = [...new Set(basket)];
        for (const item of uniqueItems) {
          if (matchProductText(item, normalizedTarget)) continue;
          coOccurrenceCounts.set(item, (coOccurrenceCounts.get(item) || 0) + 1);
        }
      }

      // Step 4: Compute support and confidence
      const MIN_SUPPORT = 0.01; // Lower threshold to allow small datasets to show rules
      const MIN_CONFIDENCE = 0.1;

      for (const [itemName, coCount] of coOccurrenceCounts.entries()) {
        const support = coCount / totalPOs;
        const confidence = coCount / targetOccurrences;

        if (support >= MIN_SUPPORT && confidence >= MIN_CONFIDENCE) {
          associations.push({
            product_name: itemName,
            support: Number((support * 100).toFixed(1)),
            confidence: Number((confidence * 100).toFixed(1)),
            co_occurrences: coCount,
          });
        }
      }

      associations.sort((a, b) => b.confidence - a.confidence || b.support - a.support);
    }
  }

  // ─── Dynamic Fallback (If no associations found in transactional history) ───
  // We query the actual product catalog so we only suggest products that exist in the database.
  if (associations.length === 0) {
    const productsPayload = await fetchJson(
      `${env.productCatalogServiceUrl}/products?limit=100`,
      "product-catalog",
    );
    const catalogProducts = extractArray(productsPayload);

    if (catalogProducts.length > 0) {
      // Build proper full labels: "SKU - Name" to match InboundProcurement format
      const formattedCatalog = catalogProducts.map(p => {
        const sku = cleanText(p.sku);
        const name = cleanText(p.product_name);
        return {
          sku,
          name,
          label: sku && name ? `${sku} - ${name}` : (sku || name)
        };
      });

      // Hardcoded logical combinations
      const logicalRules = [
        { trigger: "paracetamol", recommend: ["ibuprofen", "amoxicillin", "vitamin"] },
        { trigger: "amoxicillin", recommend: ["paracetamol", "clavulanate"] },
        { trigger: "losartan", recommend: ["metformin", "amlodipine", "atorvastatin"] },
        { trigger: "metformin", recommend: ["losartan", "gliclazide"] },
        { trigger: "insulin", recommend: ["metformin", "syringe"] },
      ];

      // Find which rules match the current target
      const activeRule = logicalRules.find(r => normalizedTarget.includes(r.trigger));

      if (activeRule) {
        // Find matching products in our database catalog for the recommendations
        for (const recTrigger of activeRule.recommend) {
          const matchedProduct = formattedCatalog.find(p =>
            p.name.toLowerCase().includes(recTrigger) || p.sku.toLowerCase().includes(recTrigger)
          );

          if (matchedProduct) {
            associations.push({
              product_name: matchedProduct.label,
              support: 25.0,
              confidence: 75.0,
              co_occurrences: 1,
              is_fallback: true
            });
          }
        }
      }

      // If still empty, grab any other 1-2 products from the catalog to ensure a valid suggestion
      if (associations.length === 0 && formattedCatalog.length > 1) {
        const otherProducts = formattedCatalog.filter(p => !matchProductText(p.label, normalizedTarget));
        // Take up to 2 items
        otherProducts.slice(0, 2).forEach((prod) => {
          associations.push({
            product_name: prod.label,
            support: 20.0,
            confidence: 50.0,
            co_occurrences: 1,
            is_fallback: true
          });
        });
      }
    }
  }

  return {
    product: targetLabel,
    associations: associations.slice(0, 5),
    totalPOs,
    targetOccurrences,
  };
};
