import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const app = new Hono();

app.use("*", logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ALLOWED_STATUSES = ["Active", "Suspended"] as const;

type SupplierRecord = {
  id: string;
  supplier_name: string;
  lead_time_days: number | null;
  status: string | null;
};

type SupplierScorecardRecord = {
  supplier_name: string;
  reliability_score: number | null;
  on_time_delivery_pct: number | null;
  defect_rate: number | null;
  total_discrepancies: number | null;
  total_pos: number | null;
  total_receipts: number | null;
};

type RiskAssessmentRecord = {
  supplier_name: string;
  risk_level: string | null;
  audit_date: string | null;
  created_at: string | null;
};

const handleCompareSuppliers = async (c: any) => {
  try {
    const body = await c.req.json();
    const supplier_ids = Array.isArray(body?.supplier_ids)
      ? body.supplier_ids
          .filter((value: unknown): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    if (supplier_ids.length < 2) {
      return c.json(
        {
          error: "Please provide at least two supplier_ids",
        },
        400,
      );
    }

    const uniqueSupplierIds = Array.from(new Set(supplier_ids));

    const { data: suppliers, error: suppliersError } = await supabase
      .from("suppliers")
      .select("id, supplier_name, lead_time_days, status")
      .in("id", uniqueSupplierIds);

    if (suppliersError) {
      console.error("Supplier compare fetch error:", suppliersError);
      return c.json(
        {
          error: "Failed to fetch suppliers",
          details: suppliersError.message,
        },
        500,
      );
    }

    const supplierRows = (suppliers ?? []) as SupplierRecord[];
    if (supplierRows.length !== uniqueSupplierIds.length) {
      const foundIds = new Set(supplierRows.map((supplier) => supplier.id));
      const missing_supplier_ids = uniqueSupplierIds.filter((id) => !foundIds.has(id));
      return c.json(
        {
          error: "Some supplier_ids were not found",
          missing_supplier_ids,
        },
        404,
      );
    }

    const supplierNames = supplierRows
      .map((supplier) => supplier.supplier_name?.trim())
      .filter((value): value is string => Boolean(value));

    const [
      { data: scorecards, error: scorecardsError },
      { data: riskAssessments, error: riskError },
    ] = await Promise.all([
      supabase
        .from("supplier_scorecards_view")
        .select(
          "supplier_name, reliability_score, on_time_delivery_pct, defect_rate, total_discrepancies, total_pos, total_receipts",
        )
        .in("supplier_name", supplierNames),
      supabase
        .from("risk_assessments")
        .select("supplier_name, risk_level, audit_date, created_at")
        .in("supplier_name", supplierNames)
        .order("created_at", { ascending: false }),
    ]);

    if (scorecardsError) {
      console.error("Supplier compare scorecard error:", scorecardsError);
      return c.json(
        {
          error: "Failed to fetch supplier scorecards",
          details: scorecardsError.message,
        },
        500,
      );
    }

    if (riskError) {
      console.error("Supplier compare risk error:", riskError);
      return c.json(
        {
          error: "Failed to fetch supplier risk data",
          details: riskError.message,
        },
        500,
      );
    }

    const scorecardByName = new Map<string, SupplierScorecardRecord>();
    for (const scorecard of (scorecards ?? []) as SupplierScorecardRecord[]) {
      scorecardByName.set(scorecard.supplier_name, scorecard);
    }

    const latestRiskByName = new Map<string, RiskAssessmentRecord>();
    for (const assessment of (riskAssessments ?? []) as RiskAssessmentRecord[]) {
      if (!latestRiskByName.has(assessment.supplier_name)) {
        latestRiskByName.set(assessment.supplier_name, assessment);
      }
    }

    const riskPenalty = (riskLevel: string | null) => {
      if (riskLevel === "High") return 15;
      if (riskLevel === "Medium") return 7;
      return 0;
    };

    const ranked = supplierRows
      .map((supplier) => {
        const scorecard = scorecardByName.get(supplier.supplier_name);
        const risk = latestRiskByName.get(supplier.supplier_name);

        const onTimeDelivery =
          scorecard?.on_time_delivery_pct ?? null;
        const defectRate =
          scorecard?.defect_rate ??
          (scorecard?.total_pos
            ? (Number(scorecard.total_discrepancies ?? 0) / Number(scorecard.total_pos)) * 100
            : null);
        const reliabilityScore = scorecard?.reliability_score ?? null;
        const score =
          Number(
            (
              (reliabilityScore ?? 0) * 0.5 +
              (onTimeDelivery ?? 0) * 0.3 +
              Math.max(0, 100 - (defectRate ?? 0) * 5) * 0.2 -
              riskPenalty(risk?.risk_level ?? null)
            ).toFixed(1),
          );

        return {
          supplier_id: supplier.id,
          supplier_name: supplier.supplier_name,
          rank: 0,
          score,
          on_time_delivery: onTimeDelivery,
          defect_rate: defectRate,
          lead_time_days: supplier.lead_time_days,
          status: supplier.status,
          risk_level: risk?.risk_level ?? "Low",
          reliability_score: reliabilityScore,
          clean_receipt_rate: null,
          total_pos: scorecard?.total_pos ?? 0,
          total_receipts: scorecard?.total_receipts ?? 0,
          last_audit_date: risk?.audit_date ?? null,
        };
      })
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return (left.lead_time_days ?? Number.MAX_SAFE_INTEGER) - (right.lead_time_days ?? Number.MAX_SAFE_INTEGER);
      })
      .map((supplier, index) => ({
        ...supplier,
        rank: index + 1,
      }));

    return c.json(
      {
        success: true,
        supplier_ids: uniqueSupplierIds,
        ranked,
      },
      200,
    );
  } catch (error) {
    console.error("Error comparing suppliers:", error);
    return c.json(
      {
        error: "Failed to compare suppliers",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

const handleUpdateSupplierStatus = async (c: any) => {
  try {
    const supplier_name = c.req.param("supplier_name");
    const body = await c.req.json();
    const status = body?.status;

    if (!supplier_name) {
      return c.json({ error: "Missing supplier_name" }, 400);
    }

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return c.json(
        {
          error: "Invalid status",
          allowed: ALLOWED_STATUSES,
        },
        400,
      );
    }

    const { data, error } = await supabase
      .from("suppliers")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("supplier_name", supplier_name)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Update error:", error);
      return c.json(
        {
          error: "Failed to update supplier status",
          details: error.message,
        },
        500,
      );
    }

    if (!data) {
      return c.json(
        {
          error: "Supplier not found",
          supplier_name,
        },
        404,
      );
    }

    return c.json(
      {
        success: true,
        message: "Supplier status updated successfully",
        supplier: data,
      },
      200,
    );
  } catch (error) {
    console.error("Error updating supplier status:", error);
    return c.json(
      {
        error: "Failed to update supplier status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

const handleGetSupplierPayments = async (c: any) => {
  try {
    const supplier_name = c.req.param("supplier_name");
    const page = Number(c.req.query("page") || "1");
    const pageSize = 20;

    if (!supplier_name) {
      return c.json({ error: "Missing supplier_name" }, 400);
    }

    if (!Number.isInteger(page) || page < 1) {
      return c.json({ error: "Invalid page" }, 400);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from("payments")
      .select("*", { count: "exact" })
      .eq("supplier_name", supplier_name)
      .order("payment_date", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Payment fetch error:", error);
      return c.json(
        {
          error: "Failed to fetch payment history",
          details: error.message,
        },
        500,
      );
    }

    const total = count || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return c.json(
      {
        success: true,
        payments: data || [],
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext,
          hasPrev,
        },
      },
      200,
    );
  } catch (error) {
    console.error("Error fetching supplier payments:", error);
    return c.json(
      {
        error: "Failed to fetch payment history",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

app.get("/health", (c) => {
  return c.json({ status: "ok", service: "suppliers" });
});

// Support direct function URL paths
app.post("/", handleCompareSuppliers);
app.post("/compare", handleCompareSuppliers);
app.post("/compare/", handleCompareSuppliers);
app.put("/:supplier_name/status", handleUpdateSupplierStatus);
app.get("/:supplier_name/payments", handleGetSupplierPayments);

// Support prefixed paths for compatibility
app.post("/suppliers", handleCompareSuppliers);
app.post("/suppliers/compare", handleCompareSuppliers);
app.post("/suppliers/compare/", handleCompareSuppliers);
app.put("/suppliers/:supplier_name/status", handleUpdateSupplierStatus);
app.get("/suppliers/:supplier_name/payments", handleGetSupplierPayments);

Deno.serve(app.fetch);
