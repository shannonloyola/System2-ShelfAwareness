import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";

const app = new Hono();

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

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

const handleScheduleDelivery = async (c: any) => {
  try {
    const body = await c.req.json();
    console.log("Received delivery schedule data:", body);

    const requiredFields = [
      "delivery_datetime",
      "supplier_name",
      "expected_items_count",
      "warehouse_location",
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

    const expectedItemsCount = parseInt(String(body.expected_items_count), 10);
    if (Number.isNaN(expectedItemsCount) || expectedItemsCount <= 0) {
      return c.json(
        {
          error: "Invalid expected_items_count",
          message: "Expected items count must be a positive integer",
        },
        400,
      );
    }

    const deliveryDate = new Date(body.delivery_datetime);
    if (Number.isNaN(deliveryDate.getTime())) {
      return c.json(
        {
          error: "Invalid delivery_datetime",
          message: "Delivery datetime must be a valid ISO date string",
        },
        400,
      );
    }

    const scheduleId = `ds_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const deliveryScheduleData = {
      id: scheduleId,
      delivery_datetime: body.delivery_datetime,
      supplier_name: body.supplier_name,
      expected_items_count: expectedItemsCount,
      warehouse_location: body.warehouse_location,
      contact_person_name: body.contact_person_name || null,
      contact_phone: body.contact_phone || null,
      notes: body.notes || null,
      status: "scheduled",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("delivery_schedules")
      .insert(deliveryScheduleData)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return c.json(
        {
          error: "Failed to schedule delivery",
          message: error.message,
          details: error.details,
        },
        500,
      );
    }

    console.log("Delivery scheduled successfully:", data);

    return c.json(
      {
        success: true,
        message: "Delivery scheduled successfully. The warehouse is now expecting this delivery.",
        id: scheduleId,
        delivery_schedule: data,
      },
      200,
    );
  } catch (error) {
    console.error("Error scheduling delivery:", error);
    return c.json(
      {
        error: "Failed to schedule delivery",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

// For invoke("shipments")
app.post("/shipments", handleScheduleDelivery);

// Optional compatibility route if you ever call /shipments/delivery-schedule directly
app.post("/shipments/delivery-schedule", handleScheduleDelivery);

app.get("/shipments/health", (c) => {
  return c.json({ status: "ok", service: "shipments" });
});

Deno.serve(app.fetch);