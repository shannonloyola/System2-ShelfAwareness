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

const handleRiskAssessmentSubmit = async (c: any) => {
  try {
    const body = await c.req.json();
    console.log("Received risk assessment data:", body);

    const requiredFields = [
      "supplier_name",
      "audit_date",
      "compliance_status",
      "assessor_name",
    ];

    const missingFields = requiredFields.filter((field) => !body[field]);

    if (missingFields.length > 0) {
      return c.json(
        {
          error: "Missing required fields",
          missingFields,
          message: `Please provide: ${missingFields.join(", ")}`,
        },
        400,
      );
    }

    let risk_level = "Low";
    if (body.compliance_status === "Non-Compliant") {
      risk_level = "High";
    } else if (body.compliance_status === "Under Review") {
      risk_level = "Medium";
    }

    const payload = {
      supplier_name: body.supplier_name,
      audit_date: body.audit_date,
      compliance_status: body.compliance_status,
      findings: body.findings || null,
      assessor_name: body.assessor_name,
      risk_notes: body.risk_notes || null,
      risk_level,
    };

    const { data, error } = await supabase
      .from("risk_assessments")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      console.error("Insert error:", error);
      return c.json(
        {
          error: "Failed to save risk assessment",
          details: error.message,
        },
        500,
      );
    }

    return c.json(
      {
        success: true,
        message: "Risk assessment submitted successfully",
        risk_level,
        is_high_risk: risk_level === "High",
        assessment: data,
      },
      200,
    );
  } catch (error) {
    console.error("Error submitting risk assessment:", error);
    return c.json(
      {
        error: "Failed to submit risk assessment",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

const handleGetLatestRiskAssessment = async (c: any) => {
  try {
    const supplier_name = c.req.param("supplier_name");

    const { data, error } = await supabase
      .from("risk_assessments")
      .select("*")
      .eq("supplier_name", supplier_name)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Fetch error:", error);
      return c.json(
        {
          error: "Failed to fetch risk assessment",
          details: error.message,
        },
        500,
      );
    }

    return c.json({
      success: true,
      assessment: data,
      is_high_risk: data?.risk_level === "High" || false,
    });
  } catch (error) {
    console.error("Error fetching risk assessment:", error);
    return c.json(
      {
        error: "Failed to fetch risk assessment",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

// Support invoke("risk-assessments")
app.post("/risk-assessments", handleRiskAssessmentSubmit);

// Optional fallback routes
app.post("/risk-assessments/submit", handleRiskAssessmentSubmit);
app.post("/", handleRiskAssessmentSubmit);

// Health check
app.get("/risk-assessments/health", (c) => {
  return c.json({ status: "ok", service: "risk-assessments" });
});

// Get latest by supplier
app.get("/risk-assessments/:supplier_name", handleGetLatestRiskAssessment);
app.get("/:supplier_name", handleGetLatestRiskAssessment);

Deno.serve(app.fetch);